const crypto = require('crypto');

const generateApiKey = () => {
  const key = 'ak_' + crypto.randomBytes(32).toString('hex');
  const prefix = key.substring(0, 11); // "ak_" + first 8 hex chars
  return { key, prefix };
};

module.exports = { generateApiKey };
