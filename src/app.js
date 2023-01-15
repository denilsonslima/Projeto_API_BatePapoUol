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
    const name = req.body
    const schema = joi.object({
        name: joi.string().required(),
    });

    const validation = schema.validate(name, { abortEarly: false })
    if (validation.error) {
        const erros = validation.error.details.map((err) => err.message)
        return res.status(422).send(erros)
    }

    try {
        const existe = await db.collection("participants").findOne({ name: name.name })
        if (existe) return res.status(409).send("Usuário já cadastrado!")

        await db.collection("participants").insertOne({ name: name.name, lastStatus: Date.now()})
        await db.collection('messages').insertOne({from: name.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format("HH:mm:ss")});
        res.sendStatus(201)
    } catch (error) {
        console.log(error)
        res.sendStatus(500)
    }
})

app.get("/participants", async (req, res) => {
   const dados =  await db.collection("participants").find().toArray()
   res.send(dados)
})


const PORT = 5000
app.listen(5000, () => console.log(`Servidor rodando na porta: ${PORT}`))