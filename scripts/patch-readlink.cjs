// Build-only exFAT/FAT compatibility preload (no app behaviour change).
//
// exFAT/FAT volumes have no symlinks and Node's readlink returns EISDIR (instead
// of EINVAL) on regular files/directories. Webpack / Next only handle EINVAL /
// ENOENT while probing for symlinks, so the raw EISDIR crashes the production
// build. This preload (loaded via NODE_OPTIONS=--require before any tool code,
// including graceful-fs) translates EISDIR -> EINVAL so callers treat the path as
// "not a symlink" and continue. It is a no-op on NTFS / ext4 / APFS.
const fs = require("node:fs");

function norm(err) {
  if (err && err.code === "EISDIR") err.code = "EINVAL";
  return err;
}

const _readlink = fs.readlink.bind(fs);
fs.readlink = (path, options, callback) => {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "function" ? undefined : options;
  const wrapped = (err, result) => cb(norm(err), result);
  return opts === undefined ? _readlink(path, wrapped) : _readlink(path, opts, wrapped);
};

const _readlinkSync = fs.readlinkSync.bind(fs);
fs.readlinkSync = (...args) => {
  try {
    return _readlinkSync(...args);
  } catch (e) {
    throw norm(e);
  }
};

if (fs.promises && fs.promises.readlink) {
  const _p = fs.promises.readlink.bind(fs.promises);
  fs.promises.readlink = async (...args) => {
    try {
      return await _p(...args);
    } catch (e) {
      throw norm(e);
    }
  };
}
