const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const chatRoute = require('./routes/chat');

dotenv.config();
const app = express();
app.use(bodyParser.json());

app.use('/api/chat', chatRoute);

app.listen(3001, () => console.log('Server running on port 3001'));
