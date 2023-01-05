use napi::bindgen_prelude::*;
use xxhash_rust::xxh3;

#[macro_use]
extern crate napi_derive;

#[napi]
pub fn sum(a: i32, b: i32) -> i32 {
    a + b
}

#[napi]
pub fn hash(hash_content: Either<String, Buffer>) -> u64 {
    xxh3::xxh3_64(match &hash_content {
        Either::A(s) => s.as_bytes(),
        Either::B(b) => b.as_ref(),
    })
}
