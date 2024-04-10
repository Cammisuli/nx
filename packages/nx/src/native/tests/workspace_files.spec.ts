import { WorkspaceContext } from '../index';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { NxJsonConfiguration } from '../../config/nx-json';
import { dirname, join } from 'path';
import { readJsonFile } from '../../utils/fileutils';
import { cacheDirectoryForWorkspace } from '../../utils/cache-directory';

describe('workspace files', () => {
  function createParseConfigurationsFunction(tempDir: string) {
    return async (filenames: string[]) => {
      const res = {};
      for (const filename of filenames) {
        const json = readJsonFile(join(tempDir, filename));
        res[dirname(filename)] = json.name;
      }
      return res;
    };
  }

  it('should gather workspace file information', async () => {
    const fs = new TempFs('workspace-files');
    const nxJson: NxJsonConfiguration = {};
    await fs.createFiles({
      './nx.json': JSON.stringify(nxJson),
      './package.json': JSON.stringify({
        name: 'repo-name',
        version: '0.0.0',
        dependencies: {},
      }),
      './libs/project1/project.json': JSON.stringify({
        name: 'project1',
      }),
      './libs/project1/index.js': '',
      './libs/project2/project.json': JSON.stringify({
        name: 'project2',
      }),
      './libs/project2/index.js': '',
      './libs/project3/project.json': JSON.stringify({
        name: 'project3',
      }),
      './libs/project3/index.js': '',
      './libs/nested/project/project.json': JSON.stringify({
        name: 'nested-project',
      }),
      './libs/nested/project/index.js': '',
      './libs/package-project/package.json': JSON.stringify({
        name: 'package-project',
      }),
      './libs/package-project/index.js': '',
      './nested/non-project/file.txt': '',
    });

    const context = new WorkspaceContext(
      fs.tempDir,
      cacheDirectoryForWorkspace(fs.tempDir)
    );
    let { projectFileMap, globalFiles } = context.getWorkspaceFiles({
      'libs/project1': 'project1',
      'libs/project2': 'project2',
      'libs/project3': 'project3',
      'libs/nested/project': 'nested-project',
      'libs/package-project': 'package-project',
    });

    expect(projectFileMap).toMatchInlineSnapshot(`
      {
        "nested-project": [
          {
            "file": "libs/nested/project/index.js",
            "hash": "3244421341483603138",
            "size": 0,
          },
          {
            "file": "libs/nested/project/project.json",
            "hash": "2709826705451517790",
            "size": 25,
          },
        ],
        "package-project": [
          {
            "file": "libs/package-project/index.js",
            "hash": "3244421341483603138",
            "size": 0,
          },
          {
            "file": "libs/package-project/package.json",
            "hash": "1637510190365604632",
            "size": 26,
          },
        ],
        "project1": [
          {
            "file": "libs/project1/index.js",
            "hash": "3244421341483603138",
            "size": 0,
          },
          {
            "file": "libs/project1/project.json",
            "hash": "13466615737813422520",
            "size": 19,
          },
        ],
        "project2": [
          {
            "file": "libs/project2/index.js",
            "hash": "3244421341483603138",
            "size": 0,
          },
          {
            "file": "libs/project2/project.json",
            "hash": "1088730393343835373",
            "size": 19,
          },
        ],
        "project3": [
          {
            "file": "libs/project3/index.js",
            "hash": "3244421341483603138",
            "size": 0,
          },
          {
            "file": "libs/project3/project.json",
            "hash": "4575237344652189098",
            "size": 19,
          },
        ],
      }
    `);
    expect(globalFiles).toMatchInlineSnapshot(`
      [
        {
          "file": "nested/non-project/file.txt",
          "hash": "3244421341483603138",
          "size": 0,
        },
        {
          "file": "nx.json",
          "hash": "1389868326933519382",
          "size": 2,
        },
        {
          "file": "package.json",
          "hash": "14409636362330144230",
          "size": 56,
        },
      ]
    `);
  });

  it('should assign files to the root project if it exists', async () => {
    const fs = new TempFs('workspace-files');
    const nxJson: NxJsonConfiguration = {};
    await fs.createFiles({
      './nx.json': JSON.stringify(nxJson),
      './package.json': JSON.stringify({
        name: 'repo-name',
        version: '0.0.0',
        dependencies: {},
      }),
      './project.json': JSON.stringify({
        name: 'repo-name',
      }),
      './src/index.js': '',
      './jest.config.js': '',
    });

    const context = new WorkspaceContext(
      fs.tempDir,
      cacheDirectoryForWorkspace(fs.tempDir)
    );

    const { globalFiles, projectFileMap } = await context.getWorkspaceFiles({
      '.': 'repo-name',
    });

    expect(globalFiles).toEqual([]);
    expect(projectFileMap['repo-name']).toMatchInlineSnapshot(`
      [
        {
          "file": "jest.config.js",
          "hash": "3244421341483603138",
          "size": 0,
        },
        {
          "file": "nx.json",
          "hash": "1389868326933519382",
          "size": 2,
        },
        {
          "file": "package.json",
          "hash": "14409636362330144230",
          "size": 56,
        },
        {
          "file": "project.json",
          "hash": "4357927788053707201",
          "size": 20,
        },
        {
          "file": "src/index.js",
          "hash": "3244421341483603138",
          "size": 0,
        },
      ]
    `);
  });

  describe('globbing', () => {
    let context: WorkspaceContext;
    let fs: TempFs;

    beforeEach(async () => {
      fs = new TempFs('workspace-files');

      await fs.createFiles({
        'file.txt': '',
        'file.css': '',
        'file.js': '',
      });

      context = new WorkspaceContext(
        fs.tempDir,
        cacheDirectoryForWorkspace(fs.tempDir)
      );
    });

    afterEach(() => {
      context = null;
      fs.reset();
    });

    it('should glob', () => {
      const results = context.glob(['**/*.txt']);
      expect(results).toContain('file.txt');
      expect(results).not.toContain('file.css');
      expect(results).not.toContain('file.js');
    });

    it('should glob and exclude patterns', () => {
      const results = context.glob(['**/*'], ['**/*.txt']);
      expect(results).not.toContain('file.txt');
      expect(results).toContain('file.css');
      expect(results).toContain('file.js');
    });

    it('should glob and not exclude if exclude is empty', () => {
      const results = context.glob(['**/*'], []);
      expect(results).toContain('file.txt');
      expect(results).toContain('file.css');
      expect(results).toContain('file.js');
    });
  });

  // describe('errors', () => {
  //   it('it should infer names of configuration files without a name', async () => {
  //     const fs = new TempFs('workspace-files');
  //     const nxJson: NxJsonConfiguration = {};
  //     await fs.createFiles({
  //       './nx.json': JSON.stringify(nxJson),
  //       './package.json': JSON.stringify({
  //         name: 'repo-name',
  //         version: '0.0.0',
  //         dependencies: {},
  //       }),
  //       './libs/project1/project.json': JSON.stringify({
  //         name: 'project1',
  //       }),
  //       './libs/project1/index.js': '',
  //       './libs/project2/project.json': JSON.stringify({}),
  //     });
  //
  //     let globs = ['project.json', '**/project.json', 'libs/*/package.json'];
  //     expect(getWorkspaceFilesNative(fs.tempDir, globs).projectFileMap)
  //       .toMatchInlineSnapshot(`
  //       {
  //         "libs/project1": [
  //           {
  //             "file": "libs/project1/index.js",
  //             "hash": "3244421341483603138",
  //           },
  //           {
  //             "file": "libs/project1/project.json",
  //             "hash": "13466615737813422520",
  //           },
  //         ],
  //         "libs/project2": [
  //           {
  //             "file": "libs/project2/project.json",
  //             "hash": "1389868326933519382",
  //           },
  //         ],
  //       }
  //     `);
  //   });
  //
  //   it('handles comments', async () => {
  //     const fs = new TempFs('workspace-files');
  //     const nxJson: NxJsonConfiguration = {};
  //     await fs.createFiles({
  //       './nx.json': JSON.stringify(nxJson),
  //       './package.json': JSON.stringify({
  //         name: 'repo-name',
  //         version: '0.0.0',
  //         dependencies: {},
  //       }),
  //       './libs/project1/project.json': `{
  //       "name": "temp"
  //       // this should not fail
  //       }`,
  //       './libs/project1/index.js': '',
  //     });
  //
  //     let globs = ['project.json', '**/project.json', 'libs/*/package.json'];
  //     expect(() => getWorkspaceFilesNative(fs.tempDir, globs)).not.toThrow();
  //   });
  //
  //   it('handles extra comma', async () => {
  //     const fs = new TempFs('workspace-files');
  //     const nxJson: NxJsonConfiguration = {};
  //     await fs.createFiles({
  //       './nx.json': JSON.stringify(nxJson),
  //       './package.json': JSON.stringify({
  //         name: 'repo-name',
  //         version: '0.0.0',
  //         dependencies: {},
  //       }),
  //       './libs/project1/project.json': `{
  //       "name": "temp",
  //       }`,
  //       './libs/project1/index.js': '',
  //     });
  //
  //     let globs = ['**/project.json'];
  //     expect(() => getWorkspaceFilesNative(fs.tempDir, globs)).not.toThrow();
  //   });
  // });
});
