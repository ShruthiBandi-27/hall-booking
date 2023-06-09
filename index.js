import express from 'express';
import {MongoClient} from "mongodb";
import * as dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 4000;
const MONGO_URL = process.env.MONGO_URL;

//create connection to db
async function createConnection() {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log("Connected to mongodb");
    return client;
}

export const client = await createConnection();

app.use(express.json());
app.use(cors());

app.get("/", (req, res)=> {
    res.send("<h1>Hello, Welcome to Hall Booking App!!!</h1>");
})

// Creating rooms
app.post("/create-room", async (req, res) => {
    const room = req.body;
    console.log(`room: ${JSON.stringify(room)}`);
    const result = await client.db("hall_booking").collection("rooms").insertOne(room);
    res.status(200).send({
        message: "Room created successfully"
    });
})

// Booking rooms
app.post("/book-room", async (req,res) => {
    const customer = req.body;
    const {room_no, customer_name} = req.body;
    console.log(`customer: ${JSON.stringify(customer)}`);

    //Checking if room is available or not
    const room = await client.db("hall_booking").collection("rooms").findOne({room_no: room_no});
    console.log(`room_no: ${room_no}`);
    console.log(`room: ${room}`);
    if(!room) {
        res.status(404).send({
            message: "No Room Found"
        });
        return;
    }
    if(room.room_status == "Booked"){
        res.send({
            message: "Sorry, Room was already Booked!!!"
        });
        return;
    }

    const CustomerPresent = await client.db("hall_booking").collection("customers").findOne({customer_name: customer_name, room_no: room_no});
    if(CustomerPresent) {
        const {booked_no_of_times} = CustomerPresent;
        const result = await client.db("hall_booking").collection("customers").updateOne({room_no: room_no}, {$set: {booked_no_of_times : booked_no_of_times + 1}});
        console.log(`result after updating booked counter: ${result}`);
    }
    else{
    //Inserting customer info to db
    customer.booking_id = uuidv4();
    customer.booked_no_of_times = 1;
    const result = await client.db("hall_booking").collection("customers").insertOne(customer);

    console.log(`result after booking: ${JSON.stringify(result)}`);
    }
    
    //Updating room status as booked
    await client.db("hall_booking").collection("rooms").updateOne({room_no: room_no}, {$set: {room_status: "Booked"}});

    res.status(200).send({
        message: "Room Booked Successfully"
    });
})

// fetching rooms data
app.get("/rooms", async (req, res) => {
    //const rooms = await client.db("hall_booking").collection("rooms").find().toArray();
    const projection = {"room_no":1, "date":1, "start-time": 1, "end-time": 1, "room_status": 1, "customer_details.customer_name":1 }
    const room_details = await client.db("hall_booking").collection("rooms").aggregate([
        {
            $lookup: {
                from: "customers",
                localField: "room_no",
                foreignField: "room_no",
                as: "customer_details"
            }
        },
        {
            $project: projection
        }
    ]).toArray();

    if(!room_details) {
        res.status(404).send({
            message: "No rooms found"
        })
        return;
    }

    console.log(`rooms data: ${JSON.stringify(room_details)}`);
    res.status(200).send(room_details);
})

// fetching all customers details
app.get("/customers", async (req, res) => {
    const projection = {"customer_name": 1, "room_no":1, "date":1, "start-time":1, "end-time":1}
    const customers_details = await client.db("hall_booking").collection("customers").find({},projection).toArray();
    console.log(`Customer data: ${JSON.stringify(customers_details)}`);
    if(!customers_details){
        res.status(404).send({
            message: "No customers found"
        });
        return;
    }
    res.status(200).send(customers_details);
})

// fetching the selected customer data
app.get("/customer_details/:customer_name", async (req, res) => {
    const {customer_name} = req.params;
    //const {mentor} = req.query;
    console.log(`customer_name: ${customer_name}`);
    const projection = {"customer_name": 1, "room_no":1, "date":1, "start-time": 1, "end-time": 1, "room_details.room_status":1 }
    const customer_details = await client.db("hall_booking").collection("customers").aggregate([
        {
            $match : {
                customer_name: customer_name
            }
        },
        {
            $lookup: {
                from: "rooms",
                localField: "room_no",
                foreignField: "room_no",
                as: "room_details"
            }
        },
        {
            $project: projection
        }
    ]).toArray();

    res.status(200).send(customer_details);

});

app.listen(PORT, ()=> {
    console.log(`The server is listening on port ${PORT}`);
});

console.log("End of index.js");