use napi::bindgen_prelude::External;
use std::collections::HashMap;

use crate::native::hasher::hash;
use crate::native::utils::{path::get_child_files, Normalize};
use rayon::prelude::*;
use std::ops::Deref;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;

use crate::native::logger::enable_logger;
use crate::native::project_graph::utils::{find_project_for_path, ProjectRootMappings};
use crate::native::types::FileData;
use parking_lot::{Condvar, Mutex};
use tracing::{trace, warn};

use crate::native::workspace::files_archive::{
    create_file_archive, read_files_archive, update_file_archive, write_files_archive,
};
use crate::native::workspace::types::{
    FileMap, NxWorkspaceFilesExternals, ProjectFiles, UpdatedWorkspaceFiles,
};
use crate::native::workspace::{config_files, types::NxWorkspaceFiles, workspace_files};

#[napi]
pub struct WorkspaceContext {
    pub workspace_root: String,
    workspace_root_path: PathBuf,
    files_worker: FilesWorker,
}

#[derive(Ord, PartialOrd, Eq, PartialEq)]
struct InternalFileData {
    file: PathBuf,
    hash: String,
    size: i64,
}
type Files = Vec<InternalFileData>;

struct FilesWorker(Option<Arc<(Mutex<Files>, Condvar)>>);
impl FilesWorker {
    fn gather_files(workspace_root: &Path, cache_dir: String) -> Self {
        if !workspace_root.exists() {
            warn!(
                "workspace root does not exist: {}",
                workspace_root.display()
            );
            return FilesWorker(None);
        }

        let archived_files = read_files_archive(&cache_dir);

        let files_lock = Arc::new((Mutex::new(Vec::new()), Condvar::new()));
        let files_lock_clone = Arc::clone(&files_lock);
        let workspace_root = workspace_root.to_owned();

        thread::spawn(move || {
            trace!("locking files");
            let (lock, cvar) = &*files_lock_clone;
            let mut workspace_files = lock.lock();
            let now = std::time::Instant::now();
            let archive_files = if let Some(archived_files) = archived_files {
                update_file_archive(&workspace_root, archived_files)
            } else {
                create_file_archive(&workspace_root)
            };

            let mut files = archive_files
                .iter()
                .map(|(path, archived_file)| InternalFileData {
                    file: PathBuf::from(path),
                    hash: archived_file.hash.to_owned(),
                    size: archived_file.file_size,
                })
                .collect::<Vec<_>>();
            files.par_sort();
            trace!("hashed and sorted files in {:?}", now.elapsed());

            *workspace_files = files;
            let files_len = workspace_files.len();
            trace!(?files_len, "files retrieved");

            cvar.notify_all();

            write_files_archive(&cache_dir, archive_files);
        });

        FilesWorker(Some(files_lock))
    }

    pub fn get_files(&self) -> Vec<FileData> {
        if let Some(files_sync) = &self.0 {
            let (files_lock, cvar) = files_sync.deref();
            trace!("locking files");
            let mut files = files_lock.lock();
            let files_len = files.len();
            if files_len == 0 {
                trace!("waiting for files");
                cvar.wait(&mut files);
            }

            let file_data = files
                .iter()
                .map(|InternalFileData { file, hash, size }| FileData {
                    file: file.to_normalized_string(),
                    hash: hash.clone(),
                    size: *size,
                })
                .collect();

            drop(files);

            trace!("files are available");
            file_data
        } else {
            vec![]
        }
    }

    pub fn update_files(
        &self,
        workspace_root_path: &Path,
        updated_files: Vec<&str>,
        deleted_files: Vec<&str>,
    ) -> Vec<(String, (String, i64))> {
        let Some(files_sync) = &self.0 else {
            trace!("there were no files because the workspace root did not exist");
            return vec![];
        };

        let (files_lock, _) = &files_sync.deref();
        let mut files = files_lock.lock();
        let mut map: HashMap<PathBuf, (String, i64)> = files
            .drain(..)
            .map(|file| (file.file, (file.hash, file.size)))
            .collect();

        for deleted_file in deleted_files {
            map.remove(&PathBuf::from(deleted_file));
        }

        let updated_files_hashes: Vec<_> = updated_files
            .par_iter()
            .filter_map(|path| {
                let full_path = workspace_root_path.join(path);
                let file_size = std::fs::metadata(&full_path)
                    .map(|metadata| metadata.len())
                    .unwrap_or(0) as i64;
                let Ok(content) = std::fs::read(&full_path) else {
                    trace!("could not read file: {full_path:?}");
                    return None;
                };
                Some((path.to_string(), (hash(&content), file_size)))
            })
            .collect();

        for (file, file_data) in &updated_files_hashes {
            map.entry(file.into())
                .and_modify(|e| *e = file_data.clone())
                .or_insert(file_data.clone());
        }

        *files = map
            .into_iter()
            .map(|m| InternalFileData {
                file: m.0,
                size: m.1 .1,
                hash: m.1 .0,
            })
            .collect();
        files.par_sort();

        updated_files_hashes
    }
}

#[napi]
impl WorkspaceContext {
    #[napi(constructor)]
    pub fn new(workspace_root: String, cache_dir: String) -> Self {
        enable_logger();

        trace!(?workspace_root);

        let workspace_root_path = PathBuf::from(&workspace_root);

        WorkspaceContext {
            files_worker: FilesWorker::gather_files(&workspace_root_path, cache_dir),
            workspace_root,
            workspace_root_path,
        }
    }

    #[napi]
    pub fn get_workspace_files(
        &self,
        project_root_map: HashMap<String, String>,
    ) -> anyhow::Result<NxWorkspaceFiles> {
        workspace_files::get_files(project_root_map, self.all_file_data())
            .map_err(anyhow::Error::from)
    }

    #[napi]
    pub fn glob(
        &self,
        globs: Vec<String>,
        exclude: Option<Vec<String>>,
    ) -> napi::Result<Vec<String>> {
        let file_data = self.all_file_data();
        let globbed_files = config_files::glob_files(&file_data, globs, exclude)?;
        Ok(globbed_files.map(|file| file.file.to_owned()).collect())
    }

    #[napi]
    pub fn hash_files_matching_glob(
        &self,
        globs: Vec<String>,
        exclude: Option<Vec<String>>,
    ) -> napi::Result<String> {
        let files = &self.all_file_data();
        let globbed_files = config_files::glob_files(&files, globs, exclude)?;
        Ok(hash(
            &globbed_files
                .map(|file| file.hash.as_bytes())
                .collect::<Vec<_>>()
                .concat(),
        ))
    }

    #[napi]
    pub fn incremental_update(
        &self,
        updated_files: Vec<&str>,
        deleted_files: Vec<&str>,
    ) -> Vec<FileData> {
        self.files_worker
            .update_files(&self.workspace_root_path, updated_files, deleted_files)
            .into_iter()
            .map(|updated| FileData {
                file: updated.0,
                size: updated.1 .1,
                hash: updated.1 .0,
            })
            .collect()
    }

    #[napi]
    pub fn update_project_files(
        &self,
        project_root_mappings: ProjectRootMappings,
        project_files: External<ProjectFiles>,
        global_files: External<Vec<FileData>>,
        updated_files: Vec<FileData>,
        deleted_files: Vec<&str>,
    ) -> UpdatedWorkspaceFiles {
        trace!("updating project files");
        trace!("{project_root_mappings:?}");
        let mut project_files_map = project_files.clone();
        let mut global_files = global_files
            .iter()
            .map(|f| (f.file.clone(), (f.hash.clone(), f.size)))
            .collect::<HashMap<_, _>>();

        trace!(
            "adding {} updated files to project files",
            updated_files.len()
        );
        for updated_file in updated_files.into_iter() {
            let file = updated_file.file;
            let hash = updated_file.hash;
            let size = updated_file.size;
            if let Some(project_files) = find_project_for_path(&file, &project_root_mappings)
                .and_then(|project| project_files_map.get_mut(project))
            {
                trace!("{file:?} was found in a project");
                if let Some(file) = project_files.iter_mut().find(|f| f.file == file) {
                    trace!("updating hash for file");
                    file.hash = hash;
                    file.size = size;
                } else {
                    trace!("{file:?} was not part of a project, adding to project files");
                    project_files.push(FileData { file, hash, size });
                }
            } else {
                trace!("{file:?} was not found in any project, updating global files");
                global_files
                    .entry(file)
                    .and_modify(|e| *e = (hash.clone(), size))
                    .or_insert((hash, size));
            }
        }

        trace!(
            "removing {} deleted files from project files",
            deleted_files.len()
        );
        for deleted_file in deleted_files.into_iter() {
            if let Some(project_files) = find_project_for_path(deleted_file, &project_root_mappings)
                .and_then(|project| project_files_map.get_mut(project))
            {
                if let Some(pos) = project_files.iter().position(|f| f.file == deleted_file) {
                    trace!("removing file: {deleted_file:?} from project");
                    project_files.remove(pos);
                }
            }

            if global_files.contains_key(deleted_file) {
                trace!("removing {deleted_file:?} from global files");
                global_files.remove(deleted_file);
            }
        }

        let non_project_files = global_files
            .into_iter()
            .map(|(file, data)| FileData {
                file,
                hash: data.0,
                size: data.1,
            })
            .collect::<Vec<_>>();

        UpdatedWorkspaceFiles {
            file_map: FileMap {
                project_file_map: project_files_map.clone(),
                non_project_files: non_project_files.clone(),
            },
            external_references: NxWorkspaceFilesExternals {
                project_files: External::new(project_files_map),
                global_files: External::new(non_project_files),
                all_workspace_files: External::new(self.all_file_data()),
            },
        }
    }

    #[napi]
    pub fn all_file_data(&self) -> Vec<FileData> {
        self.files_worker.get_files()
    }

    #[napi]
    pub fn get_files_in_directory(&self, directory: String) -> Vec<String> {
        get_child_files(&directory, self.files_worker.get_files())
    }
}
