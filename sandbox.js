const express = require('express');
const router = express.Router();
const fs = require("fs");
const cors = require("cors")
const DB = require("./database");
const database = require('./database');

const stops = new database("./data/stops.json");

module.exports = () => {
    router.use(cors({
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
        credentials: true
    }));

    router.use("/*", (req, res, next) => {
        if (!req.get("Origin")&& !req.ip === "::1") return res.sendStatus(401);
        if (req.get("Origin") !== "https://hlx-sandbox.github.io/" && !req.ip === "::1") return res.sendStatus(401)
        next();
    })

    router.get("/editor/stops/upvote/:id/:s", async (r, res) => {
        if(!stops.read(r.params.id)) return res.sendStatus(404);
        let s = stops.read(r.params.id);
        if(!s.find(a => a.si.toString() === r.params.s)) return res.sendStatus(404);
        if((s.find(a => a.si.toString() === r.params.s).c2 || []).includes(r.query.id)) return res.sendStatus(404);
        s.find(a => a.si.toString() === r.params.s).c += 1;
        if(!s.find(a => a.si.toString() === r.params.s).c2) s.find(a => a.si.toString() === r.params.s).c2 = []
        s.find(a => a.si.toString() === r.params.s).c2.push(r.query.id);
        stops.write(r.params.id, s);
        res.sendStatus(200)
    });

    router.get("/editor/stops/suggest/:id", async (r, res) => {
        let u = r.query.user;
        let n = r.query.name;
        let s = stops.read(r.params.id) || [];
        s.push({i: r.params.id, name: n, user: u, si: s.length, c: 0, id: r.query.id})
        stops.write(r.params.id, s);
        res.sendStatus(200)
    });

    router.get("/editor/stops/delete/:id/:s", async (r, res) => {
        if(!stops.read(r.params.id)) return res.sendStatus(404);
        let s = stops.read(r.params.id);
        if(!s.find(a => a.si.toString() === r.params.s)) return res.sendStatus(404);
        if((s.find(a => a.si.toString() === r.params.s).c2 || []).includes(r.query.id)) return res.sendStatus(404);
        let z = s.indexOf(s.find(a => a.si.toString() === r.params.s))
        s.splice(z, 1);
        stops.write(r.params.id, s);
        res.sendStatus(200)
    });

    router.get("/editor/stops/", async (r, res) => {
        res.json(stops.all())
    });

    return router;
};