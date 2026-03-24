/**
 * Public user shape for auth + profile APIs (matches frontend LoginModalContext).
 * Always includes wallet as a number.
 */
function toPublicUser(user) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : { ...user };
  return {
    _id: u._id,
    mobile: u.mobile,
    countryCode: u.countryCode,
    name: u.name ?? null,
    email: u.email ?? null,
    wallet: u.wallet != null && u.wallet !== "" ? Number(u.wallet) : 0,
  };
}

module.exports = { toPublicUser };
