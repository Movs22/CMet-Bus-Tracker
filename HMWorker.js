const { console } = require('inspector');
const { parentPort } = require('worker_threads');

const fs = require("fs")

const vehicleManager = {
    init(date) {
        this.vehicleIds = new Map()
        this.lastTrips = new Map()
        this.tripIds = new Map()
        this.shifts = new Map()
        this.date = date.replaceAll("/", "");
        parentPort.postMessage({ type: 'log', data: "Loaded HMWorker with date " + this.date });
    },

    updateDate(date) {
        this.date = date.replaceAll("/", "");
    },

    addVehicle(vehicle) {
        if (this.shifts.has(vehicle.a + "-" + vehicle.shiftId)) return;
        if (!this.vehicleIds.has(vehicle.id) && vehicle.shiftId) {
            if (vehicle.tripId === "UNAVAILABLE_SHIFT_ID") vehicle.tripId = vehicle.a + "-" + "UNAVAILABLE_SHIFT_ID-" + vehicle.id;
            this.vehicleIds.set(vehicle.id, vehicle.a + "-" + vehicle.shiftId);
            this.lastTrips.set(vehicle.id, vehicle.tripId);
            this.tripIds.set(vehicle.tripId, vehicle.a + "-" + vehicle.shiftId);
            let pos = vehicle.lat.toFixed(4) + "|" + vehicle.lon.toFixed(4) + "|" + vehicle.stopId + "|" + (vehicle.doors ? vehicle.doors === "OPEN" ? "1" : "0" : "-1") + "|0@";
            const d = { id: vehicle.tripId, pattern: vehicle.pattern_id, start: (Math.round(Date.now()/1000)), pos: pos  };
            this.shifts.set(vehicle.a + "-" + vehicle.shiftId, { vehicleId: vehicle.id, start: (Math.round(Date.now()/1000)), finish: null, data: d });
        }
    },

    addUpdate(vehicle) {
        if (!this.vehicleIds.has(vehicle.id) || !this.shifts.has(vehicle.a + "-" + vehicle.shiftId)) return this.addVehicle(vehicle);
        if (this.lastTrips.get(vehicle.id) !== vehicle.tripId) {
            let pt = this.flush(this.vehicleIds.get(vehicle.id), vehicle.timestamp);
            this.vehicleIds.set(vehicle.id, vehicle.a + "-" + vehicle.shiftId);
            this.lastTrips.set(vehicle.id, vehicle.tripId);
            this.tripIds.set(vehicle.tripId, vehicle.a + "-" + vehicle.shiftId);
            let data = { id: vehicle.tripId, pattern: vehicle.pattern_id, start: (Math.round(Date.now()/1000)), prevTrip: pt,  pos: [ ] };
            this.shifts.set(vehicle.a + "-" + vehicle.shiftId, { vehicleId: vehicle.id, start: (Math.round(Date.now()/1000)), finish: null, data: data });
        }
        let data = this.shifts.get(vehicle.a + "-" + vehicle.shiftId).data;
        if(!data) return parentPort.postMessage({ type: 'log', data: "ERROR: " + vehicle.shiftId + " has an invalid start data:" + JSON.stringify(data) });
        let pos = vehicle.lat.toFixed(5) + "|" + vehicle.lon.toFixed(5) + "|" + vehicle.stopId + "|" + (vehicle.doors ? vehicle.doors === "OPEN" ? "1" : "0" : "-1") + "|" + (Math.round(Date.now()/1000) - data.start) + "@";
        data.pos += pos;
    },

    test() {
        return Array.from(this.shifts.values());
    },

    flush(shiftId, ts) {
        parentPort.postMessage({ type: 'log', data: "FLUSHING " + shiftId });
        let shift = this.shifts.get(shiftId);
        if(!shift) return parentPort.postMessage({ type: 'log', data: "ERROR: " + shiftId + " is unknown?" });
        let data = shift.data
        shift.data = [];
        this.shifts.set(shiftId, shift);
        
        if(!fs.existsSync("./tripHistory/" + this.date)) fs.mkdirSync("./tripHistory/" + this.date);
        if(!fs.existsSync("./tripHistory/" + this.date + "/shifts")) fs.mkdirSync("./tripHistory/" + this.date + "/shifts");
        if(!fs.existsSync("./tripHistory/" + this.date + "/shift-trips")) fs.mkdirSync("./tripHistory/" + this.date + "/shift-trips");
        if(!fs.existsSync("./tripHistory/" + this.date + "/shift-trips/" + shiftId)) {
            fs.writeFileSync("./tripHistory/" + this.date + "/shift-trips/" + shiftId, shift.vehicleId + "<" + shift.start + "\n§" + data.id + "<" + data.pattern + "<" + data.start + "<" + ts + "<" + data.pos);
        } else {
            fs.appendFileSync("./tripHistory/" + this.date + "/shift-trips/" + shiftId, "\n§" + data.id + "<" + data.pattern + "<" + data.start + "<" + ts + "<" + data.pos);
        }
        if(!fs.existsSync("./tripHistory/" + this.date + "/shifts/" + shiftId)) {
            fs.writeFileSync("./tripHistory/" + this.date + "/shifts/" + shiftId, data.start + "-" + ts + "-" + data.id);
        } else {
            fs.appendFileSync("./tripHistory/" + this.date + "/shifts/" + shiftId, "\n" + data.start + "-" + ts + "-" + data.id);
        }
        if(!fs.existsSync("./tripHistory/" + this.date + "/tripIds")) {
            fs.writeFileSync("./tripHistory/" + this.date + "/tripIds", data.id + ">" + shiftId);
        } else {
            fs.appendFileSync("./tripHistory/" + this.date + "/tripIds", "\n" + data.id + ">" + shiftId);
        }
        if(!fs.existsSync("./tripHistory/" + this.date + "/vehicles")) {
            fs.writeFileSync("./tripHistory/" + this.date + "/vehicles", shift.vehicleId + ">" + shiftId);
        } else {
            fs.appendFileSync("./tripHistory/" + this.date + "/vehicles", "\n" + shift.vehicleId + ">" + shiftId);
        }

        return data.id;
    },

    flushAll() {
        this.shifts.forEach((shift, _) => {
            this.flush(shift, Math.floor(Date.now() / 1000));
        })
    },

    getShifts() {
        parentPort.postMessage({ type: 'shifts', data: this.shifts });
    }
};

parentPort.on('message', (msg) => {
    if (msg.type === 'addVehicle') vehicleManager.addVehicle(msg.vehicle);
    else if (msg.type === 'addUpdate') vehicleManager.addUpdate(msg.vehicle);
    else if (msg.type === 'test') parentPort.postMessage({ type: 'test', data: vehicleManager.test() });
    else if (msg.type === 'flush') vehicleManager.flush(msg.shiftId, msg.ts);
    else if (msg.type === 'shifts') vehicleManager.getShifts();
    else if (msg.type === 'flushAll') vehicleManager.flushAll();
    else if (msg.type === 'init') vehicleManager.init(msg.date);
    else if (msg.type === 'date') vehicleManager.updateDate(msg.date);
    else if (msg.type === 'fetchCurrent') parentPort.postMessage({  data: (vehicleManager.shifts.has(msg.shiftId) ? vehicleManager.shifts.get(msg.shiftId) : null) });
});