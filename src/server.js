const app = require('./app');

const PORT = process.env.PORT || 5000;
// const crypto = require('crypto');

// const generateSecret = () => {
//   return crypto.randomBytes(64).toString('hex');
// };

// console.log(generateSecret());

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});