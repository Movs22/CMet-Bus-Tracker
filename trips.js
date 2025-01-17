const express = require('express');
const router = express.Router();
const cors = require("cors")
const fs = require("fs")

let date;

module.exports = (date, hm) => {
    this.date = date;
    router.use(cors({
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true
    }));

    router.get("/shift/:shift/current", async (r, s) => {
        let result = await hm.fetchCurrent(r.params.shift)
        s.json(result.data)
    })

    router.get("/shift/:date/:shift/trips", async (r, s) => {
        if(fs.existsSync("./tripHistory/" + parse(r.params.date) + "/shifts/" + r.params.shift)) {
            s.send(fs.readFileSync("./tripHistory/" + parse(r.params.date) + "/shifts/" + r.params.shift))
        } else {    
            s.sendStatus(404)
        }
    });

    router.get("/shift-trip/:date/:shift/trips", async (r, s) => {
        if(fs.existsSync("./tripHistory/" + parse(r.params.date) + "/shift-trips/" + r.params.shift)) {
            s.send(fs.readFileSync("./tripHistory/" + parse(r.params.date) + "/shift-trips/" + r.params.shift))
        } else {    
            s.sendStatus(404)
        }
    });

    router.get("/tripIds/:date/", async (r, s) => {
        if(fs.existsSync("./tripHistory/" + parse(r.params.date) + "/tripIds")) {
            s.send(fs.readFileSync("./tripHistory/" + parse(r.params.date) + "/tripIds"))
        } else {    
            s.sendStatus(404)
        }
    });

    router.get("/vehicles/:date/", async (r, s) => {
        if(fs.existsSync("./tripHistory/" + parse(r.params.date) + "/vehicles")) {
            s.send(fs.readFileSync("./tripHistory/" + parse(r.params.date) + "/vehicles"))
        } else {    
            s.sendStatus(404)
        }
    });

    return router;
};

function parse(d) {
    if(d === "now") return this.date;
    return d
}