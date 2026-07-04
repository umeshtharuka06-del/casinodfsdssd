// exFAT/FAT volumes on Windows make fs.readlink fail with EISDIR (instead of
// the EINVAL that NTFS returns) for paths that are not symlinks. webpack (and
// Next.js's snapshot layer) treat EINVAL as "not a symlink" but rethrow
// EISDIR, which kills the build on such volumes. This preload shim remaps the
// error code so builds work from exFAT drives. Load with:
//   NODE_OPTIONS=--require <this file>
"use strict";
const fs = require("fs");

function remap(err) {
  if (err && err.code === "EISDIR") {
    err.code = "EINVAL";
    err.errno = -4071; // UV_EINVAL on Windows
    if (typeof err.message === "string")
      err.message = err.message.replace("EISDIR", "EINVAL");
  }
  return err;
}

const origReadlink = fs.readlink;
fs.readlink = function (path, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  return origReadlink.call(fs, path, options, (err, link) =>
    callback(remap(err), link)
  );
};

const origReadlinkSync = fs.readlinkSync;
fs.readlinkSync = function (...args) {
  try {
    return origReadlinkSync.apply(fs, args);
  } catch (err) {
    throw remap(err);
  }
};

const origPromises = fs.promises.readlink;
fs.promises.readlink = async function (...args) {
  try {
    return await origPromises.apply(fs.promises, args);
  } catch (err) {
    throw remap(err);
  }
};
