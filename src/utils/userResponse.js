/**
 * Public user shape for auth + profile APIs (matches frontend LoginModalContext).
 * Always includes wallet as a number. Never exposes password.
 */
function toPublicUser(user) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : { ...user };
  const name = u.name && String(u.name).trim() ? String(u.name).trim() : null;

  return {
    _id: u._id,
    username: u.username ?? null,
    mobile: u.mobile ?? null,
    countryCode: u.countryCode ?? null,
    name,
    email: u.email ?? null,
    wallet: u.wallet != null && u.wallet !== "" ? Number(u.wallet) : 0,
    needsName: !name,
  };
}

module.exports = { toPublicUser };
