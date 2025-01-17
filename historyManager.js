const fs = require('fs');
const { type } = require('os');
const { Worker } = require('worker_threads');

class historyManager {
    constructor(workerFile, date) {
        this.worker = new Worker(workerFile);

        this.worker.on('message', (msg) => {
            if (msg.type === 'log') console.log("[HM Worker] " + (msg.data instanceof String || msg.data instanceof Number ? msg.data : JSON.stringify(msg.data)));
            else if (msg.type === 'shifts') this.shifts = msg.data;
        });
    
        this.worker.postMessage({ type: 'init', date: date });

        this.worker.on('error', (err) => console.error('Worker error:', err));
        this.worker.on('exit', (code) => console.log(`Worker exited with code ${code}`));
    }

    addVehicle(vehicle) {
        this.worker.postMessage({ type: 'addVehicle', vehicle });
    }

    addUpdate(vehicle) {
        this.worker.postMessage({ type: 'addUpdate', vehicle });
    }

    test() {
        this.worker.postMessage({ type: 'test' });
    }

    flush(shiftId) {
        this.worker.postMessage({ type: 'flush', shiftId });
    }

    getShifts() {
        this.worker.postMessage({ type: 'shifts' });
    }

    updateDate(date) {
        this.worker.postMessage({ type: 'date', date });
    }

    async fetchCurrent(shiftId) {
        return new Promise((resolve, reject) => {
            const handleMessage = (data) => {
                cleanup();
                resolve(data);
            };
    
            const handleError = (err) => {
                cleanup();
                reject(err);
            };
    
            const cleanup = () => {
                this.worker.off('message', handleMessage);
                this.worker.off('error', handleError);
            };
    
            this.worker.on('message', handleMessage);
            this.worker.on('error', handleError);
    
            this.worker.postMessage({ type: 'fetchCurrent', shiftId });
        });
    }
}

module.exports = historyManager;