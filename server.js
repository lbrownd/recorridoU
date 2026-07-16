const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;
let historialRutaNorte = [];

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/leaflet.js', (req, res) => { res.sendFile(path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.js')); });
app.get('/leaflet.css', (req, res) => { res.sendFile(path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.css')); });

// NUEVA RUTA: Servir el archivo de lógica de forma local
app.get('/app.js', (req, res) => { res.sendFile(path.join(__dirname, 'app.js')); });

io.on('connection', (socket) => {
    console.log(`📡 Nuevo dispositivo conectado: ${socket.id}`);
    if (historialRutaNorte.length > 0) { socket.emit('cargar_historial_bitacora', historialRutaNorte); }

    socket.on('conductor_envia_coordenadas', (data) => {
        data.ultimaActualizacion = new Date().toLocaleTimeString();
        historialRutaNorte.push(data);
        if (historialRutaNorte.length > 5000) { historialRutaNorte.shift(); }
        console.log(`🚗 [${data.rutaId}] Historial: ${historialRutaNorte.length} pts | Lat: ${data.lat}`);
        io.emit(`usuario_recibe_ruta_${data.rutaId}`, data);
    });

    socket.on('finalizar_viaje_limpiar_bitacora', () => {
        historialRutaNorte = [];
        console.log("🧹 Bitácora reseteada por el conductor.");
        io.emit('limpiar_mapa_pasajeros');
    });

    socket.on('disconnect', () => { console.log(`❌ Dispositivo desconectado: ${socket.id}`); });
});

server.listen(PORT, '0.0.0.0', () => { console.log(`🚀 Servidor corriendo en el puerto ${PORT}`); });
