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
    const result = await client.db("hallBooking").collection("rooms").insertOne(room);
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
    const room = await client.db("hallBooking").collection("rooms").findOne({room_no: room_no});
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

    const CustomerPresent = await client.db("hallBooking").collection("customers").findOne({customer_name: customer_name, room_no: room_no});
    if(CustomerPresent) {
        const {booked_no_of_times} = CustomerPresent;
        const result = await client.db("hallBooking").collection("customers").updateOne({room_no: room_no}, {$set: {booked_no_of_times : booked_no_of_times + 1}});
        console.log(`result after updating booked counter: ${result}`);
    }
    else{
    //Inserting customer info to db
    customer.booking_id = uuidv4();
    customer.booked_no_of_times = 1;
    const result = await client.db("hallBooking").collection("customers").insertOne(customer);

    console.log(`result after booking: ${JSON.stringify(result)}`);
    }
    
    //Updating room status as booked
    await client.db("hallBooking").collection("rooms").updateOne({room_no: room_no}, {$set: {room_status: "Booked"}});

    res.status(200).send({
        message: "Room Booked Successfully"
    });
})

// fetching rooms data
app.get("/rooms", async (req, res) => {
    const rooms = await client.db("hallBooking").collection("rooms").find().toArray();
    console.log(`rooms data: ${JSON.stringify(rooms)}`);
    if(!rooms) {
        res.status(404).send({
            message: "No rooms found"
        })
        return;
    }
    res.status(200).send(rooms);

})

// fetching customer data
app.get("/customers", async (req, res) => {
    const projection = {booking_id:0, booked_no_of_times:1, customer_name: 1,date: 1,start_time: 1, end_time: 1, _id: 0, room_no:1}
    //const projection = {"booking_id":0, "booked_no_of_times":1, "customer_name": 1,"date": 1,"start_time": 1, "end_time": 1, "_id": 0, "room_no":1}
    const customers = await client.db("hallBooking").collection("customers").find({}, projection).toArray();
    console.log(`Customer data: ${JSON.stringify(customers)}`);
    if(!customers){
        res.status(404).send({
            message: "No customers found"
        });
        return;
    }
    res.status(200).send(customers);
})


app.listen(PORT, ()=> {
    console.log(`The server is listening on port ${PORT}`);
});

console.log("End of index.js");