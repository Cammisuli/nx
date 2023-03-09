use napi::bindgen_prelude::Buffer;

#[napi]
pub fn compress(data: String) -> Option<Buffer> {
    zstd::bulk::compress(&data.as_bytes(), 1)
        .ok()
        .map(|x| x.into())
}

#[napi]
pub fn decompress(data: Buffer, original_size: u32) -> Option<Buffer> {
    zstd::bulk::decompress(&data, original_size as usize)
        .ok()
        .map(|x| x.into())
}
