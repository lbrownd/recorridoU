process.env.TZ = 'America/Managua';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) console.error(err.message);
    else console.log("💾 SQLite conectada.");
});

db.run(`CREATE TABLE IF NOT EXISTS bitacora_gps (
    id INTEGER PRIMARY KEY AUTOINCREMENT, rutaId TEXT, lat REAL, lng REAL, velocidad INTEGER, precision INTEGER, fecha TEXT, hora TEXT
)`);

app.use(express.json());
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/leaflet.js', (req, res) => res.sendFile(path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.js')));
app.get('/leaflet.css', (req, res) => res.sendFile(path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.css')));

app.get('/api/historial', (req, res) => {
    const { ruta, fecha } = req.query;
    db.all(`SELECT lat, lng, velocidad, precision, hora FROM bitacora_gps WHERE rutaId = ? AND fecha = ? ORDER BY id ASC`, [ruta, fecha], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

io.on('connection', (socket) => {
    const localDate = new Date();
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getDate()).padStart(2, '0');
    const hoy = `${yyyy}-${mm}-${dd}`;

    db.all(`SELECT lat, lng, velocidad, precision, hora FROM bitacora_gps WHERE rutaId = 'Ruta_Norte' AND fecha = ? ORDER BY id ASC`, [hoy], (err, rows) => {
        if (!err && rows.length > 0) socket.emit('cargar_historial_bitacora', rows);
    });

    socket.on('conductor_envia_coordenadas', (data) => {
        const ahora = new Date();
        const y = ahora.getFullYear();
        const m = String(ahora.getMonth() + 1).padStart(2, '0');
        const d = String(ahora.getDate()).padStart(2, '0');
        const f = `${y}-${m}-${d}`;
        const h = ahora.toLocaleTimeString();

        data.ultimaActualizacion = h;

        db.run(`INSERT INTO bitacora_gps (rutaId, lat, lng, velocidad, precision, fecha, hora) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
            [data.rutaId, data.lat, data.lng, data.velocidad || 0, data.precision, f, h]);

        io.emit(`usuario_recibe_ruta_${data.rutaId}`, data);
    });

    socket.on('finalizar_viaje_limpiar_bitacora', () => { io.emit('limpiar_mapa_pasajeros'); });
});

server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Puerto ${PORT}`));
