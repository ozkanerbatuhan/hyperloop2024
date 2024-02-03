// Import the necessary modules
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

// Create an Express app
const app = express();
const server = http.createServer(app);

// Create a Socket.IO instance
const io = socketIO(server);

// Define a connection event
io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle a custom event
    socket.on('chat message', (msg) => {
        console.log('Message received:', msg);
        io.emit('chat message', msg); // Broadcast the message to all connected clients
    });

    // Handle the disconnect event
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Start the server
const port = 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});