/**
 * Public user shape for auth + profile APIs (matches frontend LoginModalContext).
 * Always includes wallet as a number. Never exposes password.
 */
function toPublicUser(user) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : { ...user };
  return {
    _id: u._id,
    username: u.username ?? null,
    mobile: u.mobile,
    countryCode: u.countryCode,
    name: u.name ?? u.username ?? null,
    email: u.email ?? null,
    wallet: u.wallet != null && u.wallet !== "" ? Number(u.wallet) : 0,
  };
}

module.exports = { toPublicUser };
