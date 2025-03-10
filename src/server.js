const app = require('./app');
const { PORT } = require('./config/config');
const fs = require('fs');
const path = require('path');
const { UPLOAD_PATH } = require('./config/config');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
  console.log(`Created ${UPLOAD_PATH} directory`);
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});