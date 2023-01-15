import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb";
import dotenv from 'dotenv'
import joi from "joi"
import dayjs from "dayjs";

const app = express()
app.use(express.json())
app.use(cors())
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

try {
    await mongoClient.connect();
    db = mongoClient.db();
} catch (error) {
    console.log(error)
}

app.post("/participants", async (req, res) => {
    try {
        const name = req.body
        const schema = joi.object({
            name: joi.string().required(),
        });

        const validation = schema.validate(name, { abortEarly: false })
        if (validation.error) {
            const erros = validation.error.details.map((err) => err.message)
            return res.status(422).send(erros)
        }
        const existe = await db.collection("participants").findOne({ name: name.name })
        if (existe) return res.status(409).send("Usuário já cadastrado!")

        await db.collection("participants").insertOne({ name: name.name, lastStatus: Date.now() })
        await db.collection('messages').insertOne({ from: name.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format("HH:mm:ss") });
        res.sendStatus(201)
    } catch (error) {
        console.log(error)
        res.sendStatus(500)
    }
})

app.get("/participants", async (req, res) => {
    try {
        const dados = await db.collection("participants").find().toArray()
        res.send(dados)
    } catch (error) {
        res.sendStatus(500)
    }
})

app.post("/messages", async (req, res) => {
    try {
        const dados = req.body
        const name = req.headers.user
        const schema = joi.object({
            to: joi.string().required(),
            text: joi.string().required(),
            type: joi.string().valid("message", "private_message").required()
        });

        const validation = schema.validate(dados, { abortEarly: false })
        if (validation.error) {
            const erros = validation.error.details.map((err) => err.message)
            return res.status(422).send(erros)
        }

        const UserValido = await db.collection("participants").findOne({ name: name })
        if (!UserValido) return res.sendStatus(422)

        await db.collection("messages").insertOne({ from: name, ...dados, time: dayjs().format("HH:mm:ss") })
        res.sendStatus(201)
    } catch (error) {
        res.sendStatus(500)
    }
})

app.get("/messages", async (req, res) => {
    try {
        const limit = req.query.limit
        const user = req.headers.user
        const mensagens = await db.collection("messages").find({ $or: [{ from: user }, { to: "Todos" }, { to: user }] }).toArray()
        if (!limit) return res.send(mensagens)

        if (limit > 0 && parseInt(limit) !== "NaN") {
            const dados = mensagens.reverse().slice(0, parseInt(limit))
            return res.send(dados)
        } else {
            return res.sendStatus(422)
        }
    } catch (error) {
        res.sendStatus(500)
    }
})

app.post("/status", async (req, res) => {
    try {
        const user = req.headers.user
        const existe = await db.collection("participants").findOne({ name: user })
        if (!existe) return res.sendStatus(404)
        await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
        res.sendStatus(200)
    } catch (err) {
        return res.status(500).send(err.message);
    }
})

setInterval(async () => {
    try {
        const userAtivo = await db.collection("participants").find().toArray()
        userAtivo.forEach(e => {
            let a = Date.now() - e.lastStatus
            if (a > 10000) {
                db.collection("participants").deleteOne({ _id: ObjectId(e._id) })
                db.collection("messages").insertOne({ from: e.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs().format("HH:mm:ss") })
            }
        })
    } catch (error) {
        console.log(error)
    }
}, 15000);

const PORT = 5000
app.listen(5000, () => console.log(`Servidor rodando na porta: ${PORT}`))