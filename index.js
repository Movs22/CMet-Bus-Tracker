const express = require("express")
const CMetropolitana = require("cmetropolitana.js")
const app = express()

const NodeCache = require("node-cache")

const patternsCache = new NodeCache();

let ready = false;

let stopsRemapped;

let vehicles = {};

const departuresCache = new NodeCache();


const cors = require("cors")

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

let date = (new Date(Date.now())).toLocaleDateString()

let now = Math.round(Date.now() / 1000);

let historyManager = require("./historyManager.js")

let HM = new historyManager("./HMWorker.js", date);

let errors = 0;

HM.worker.on('exit', (code) => {
    errors++;
    if(errors > 3) return console.warn("ABORTING WORKER RESTART. TOO MANY ERRORS.")
    console.log(`Worker exited with code ${code}`)
    HM = new historyManager("./HMWorker.js", date);
});

async function init() {
    await CMetropolitana.lines.fetchAll();
    await CMetropolitana.routes.fetchAll();
    await CMetropolitana.stops.fetchAll().then(a => stopsRemapped = Object.values(CMetropolitana.stops.cache._cache).map(a => ({ id: a.id, lat: a.lat, lon: a.lon, name: a.name, lines: a.lines.map(b => ({ text: b, color: (CMetropolitana.lines.cache.get(b) || { color: "#000000" }).color })) })));
    await CMetropolitana.vehicles.fetchAll().then(r => vehicles = { ...CMetropolitana.vehicles.cache._cache });
    Object.keys(vehicles).map(key => {
        newVec = vehicles[key];
        vehicles[key] = { a: newVec.agency_id, id: newVec.id, tripId: (newVec.timestamp - now > -15000 ? newVec.trip_id : null), stopId: newVec.stop_id, timestamp: newVec.timestamp, lat: newVec.lat, lon: newVec.lon, bearing: newVec.bearing, speed: newVec.speed, doors: newVec.door_status, pattern_id: newVec.pattern_id, color: (CMetropolitana.lines.cache.get(newVec.line_id) || { color: undefined }).color, shiftId: newVec.shift_id };
        vehicles[key].prev_stop = null;
        if(newVec.timestamp - now > -15000) HM.addVehicle(vehicles[key]);
    })
    return true;
}

init().then(r => ready = r)

CMetropolitana.vehicles.on("vehicleUpdate", (oldVec, newVec) => {
    if (!newVec) {
        vehicles[oldVec.id] = undefined;
        positionCache[oldVec.id] = undefined;
    }
    if (!newVec.line_id) return;
    if (!ready) return;
    if (vehicles[newVec.id]) {
        prevStop = (newVec.stop_id === vehicles[newVec.id].stop_id ? vehicles[newVec.id].prev_stop || null : vehicles[newVec.id].stop_id)
    }
    now = Math.round(Date.now() / 1000);
    vehicles[newVec.id] = { a: newVec.agency_id, prevStop: (oldVec && oldVec.stop_id !== newVec.stop_id ? oldVec.stop_id : null), id: newVec.id, tripId: (newVec.timestamp - now > -15000 ? newVec.trip_id : null), lineId: newVec.line_id, stopId: newVec.stop_id, timestamp: newVec.timestamp, lat: newVec.lat, lon: newVec.lon, bearing: newVec.bearing, speed: newVec.speed, pattern_id: newVec.pattern_id, doors: newVec.door_status, color: (CMetropolitana.lines.cache.get(newVec.line_id.replaceAll("1998", "CP")) || { color: undefined }).color, shiftId: newVec.shift_id }
    if (vehicles[newVec.id].trip_id) vehicles[newVec.id].prev_stop = prevStop;
    if (newVec.timestamp - now > -15000) {
        HM.addUpdate(vehicles[newVec.id]);
    } else if(newVec.shiftId) {
        HM.flush(newVec.a + "-" + vehicles[newVec.id].shiftId);
    }
})

app.all("*", (_, s, next) => {
    if(!ready) return s.sendStatus(503);
    next()
})

app.get("/test", (_, s) => {
    HM.getShifts();
    setTimeout(() => {
        s.json({ data: [...HM.shifts]})
    }, 5000)
})

app.use('/sandbox', require("./sandbox")(CMetropolitana.stops.cache));

app.use('/t', require("./trips")(date, HM));

app.get("/ping", (_, s) => s.sendStatus(200));
app.get("/ready", (_, s) => (ready ? s.sendStatus(200) : s.sendStatus(404)));

app.get("/vehicles", (_, s) => {
    return s.json(!ready ? {} : Object.values(vehicles))
})

process.on("exit", () => {
    HM.flushAll();
    HM.worker.terminate();
})

app.get("/vehicles/l/:line", async (r, s) => {
    return s.json(!ready ? {} : Object.values(vehicles).filter(a => a.tripId && a.tripId.startsWith(r.params.line)))
})

app.get("/vehicles/:stop", async (r, s) => {
    if (!CMetropolitana.stops.cache.get(r.params.stop)) return s.json({})
    if (!departuresCache.get(r.params.stop)) departuresCache.set(r.params.stop, (await CMetropolitana.stops.cache.get(r.params.stop).departures(Date.now())).map(a => a.trip_id));
    return s.json(!ready ? {} : Object.values(vehicles).filter(a => CMetropolitana.stops.cache.get(r.params.stop).patterns.includes(a.pattern_id) || (departuresCache.has(r.params.stop) ? departuresCache.get(r.params.stop).includes(a.trip_id) : false)))
})

app.get("/stats", (_, s) => {
    return s.json(!ready ? {} : { vehicles: Object.values(vehicles).filter(a => a.tripId !== null && a.timestamp > now - 15*60).length, lines: CMetropolitana.lines.cache.size() })
})

app.get("/stop/:id", (r, s) => {
    let res = !ready ? {} : CMetropolitana.stops.cache.get(r.params.id);
    if (res.id) {
        res.lineCols = {}; res.lines.map(a => res.lineCols[a] = (CMetropolitana.lines.cache.get(a) || undefined).color)
        res.alert = res.alerts().map(a => ({ title: a.headerText, desc: a.descriptionText, url: a.url, effect: a.effect }));
    }
    return s.json(res)
})

app.get("/lines/:line", (r, s) => {
    let res = !ready ? {} : CMetropolitana.lines.cache.get(r.params.line);
    return s.json(res)
})

app.get("/routes/:route", (r, s) => {
    let res = !ready ? {} : CMetropolitana.routes.cache.get(r.params.route);
    return s.json(res)
})

app.get("/patterns/:pattern", async (r, s) => {
    try {
        if(patternsCache.has(r.params.pattern)) return s.json(patternsCache.get(r.params.pattern));
        let res = !ready ? {} : (await CMetropolitana.patterns.fetch(r.params.pattern) || CMetropolitana.patterns.cache.get(r.params.pattern));
        let lines = {}
        if (res.id) {
            schedule = res.trips[0].schedule
            res = { id: res.id, color: res.color, long_name: CMetropolitana.routes.cache.get(res.route_id).long_name, headsign: res.headsign, line_id: res.line_id, shape_id: res.shape_id, path: res.path.map(a => {
                a.stop.lines.map(z => !lines[z] ? lines[z] = { text: z, color: (CMetropolitana.lines.cache.get(z) || { color: undefined }).color } : null)
                return ({ id: a.stop.id, name: a.stop.name, stop_sequence: a.stop_sequence, travel_time: parseTime(schedule[a.stop_sequence - (res.path[0].stop_sequence)].travel_time), lines: a.stop.lines })
            }) }
        }
        res.lines = lines;
        patternsCache.set(r.params.pattern, res);
        return s.json(res)
    } catch (err) {
        return s.json({})
    }
})

function parseTime(t) {
    t = t.split(":")
    return parseInt(t[0]) * 60 + parseInt(t[1]) + parseInt(t[2]) / 60;
}


app.get("/stops", (r, s) => {
    return s.json(!ready ? {} : stopsRemapped)
})

app.get("/schools", (r, s) => {
    return s.json(!ready ? {} : schoolsRemapped)
})

setTimeout(() => {
    console.log("Started fetch loop!")
    setInterval(() => {
        ready = false;
        date = (new Date(Date.now())).toLocaleDateString();
        HM.updateDate(date);
        init().then(r => ready = r);
    }, 24 * 60 * 60 * 1000)
}, (new Date(now * 1000)).setHours(4) + 24 * 60 * 60 * 1000 - now * 1000)

app.get("/", (_, s) => s.sendStatus(200))

app.listen("8080", () => console.log("Server's ready!"))