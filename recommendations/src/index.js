const express = require("express");
const mongodb = require("mongodb");
const bodyParser = require("body-parser");
const amqp = require('amqplib');

if (!process.env.PORT) {
    throw new Error("Please specify the port number for the HTTP server with the environment variable PORT.");
}

if (!process.env.DBHOST) {
    throw new Error("Please specify the database host using environment variable DBHOST.");
}

if (!process.env.DBNAME) {
    throw new Error("Please specify the name of the database using environment variable DBNAME");
}

if (!process.env.RABBIT) {
    throw new Error("Please specify the name of the RabbitMQ host using environment variable RABBIT");
}

const PORT = process.env.PORT;
const DBHOST = process.env.DBHOST;
const DBNAME = process.env.DBNAME;
const RABBIT = process.env.RABBIT;

//
// Application entry point.
//
async function main() {

    const app = express();

    //
    // Enables JSON body parsing for HTTP requests.
    //
    app.use(bodyParser.json()); 

    //
    // Connects to the database server.
    //
    const client = await mongodb.MongoClient.connect(DBHOST);

    //
    // Gets the database for this microservice.
    //
    const db  = client.db(DBNAME);

	//
    // Gets the collection for storing video viewing recommendations.
    //
    const recommendationsCollection = db.collection("recommendations");

    //
    // Connects to the RabbitMQ server.
    //
    const messagingConnection = await amqp.connect(RABBIT); 

    console.log("Connected to RabbitMQ.");

    //
    // Creates a RabbitMQ messaging channel.
    //
    const messageChannel = await messagingConnection.createChannel(); 
       
    //
    // Asserts that we have a "viewed" exchange.
    //
    await messageChannel.assertExchange("viewed", "fanout"); 

	//
	// Creates an anonyous queue.
	//
	const { queue } = await messageChannel.assertQueue("", { exclusive: true }); 

    //
    // Binds the queue to the exchange.
    //
    await messageChannel.bindQueue(queue, "viewed", ""); 

    console.log(`Created queue ${queue}, binding it to "viewed" exchange.`);
    
    //
    // Start receiving messages from the "viewed" queue.
    //
    await messageChannel.consume(queue, async (msg) => {
        console.log("Received a 'viewed' message");

        const parsedMsg = JSON.parse(msg.content.toString()); // Parse the JSON message.
        
        await recommendationsCollection.insertOne({ videoPath: parsedMsg.videoPath }); // Record the "view" in the database.
        console.log(`Added video ${parsedMsg.videoPath} to recommendations.`);

        console.log("Acknowledging message was handled.");
                
        messageChannel.ack(msg); // If there is no error, acknowledge the message.
    });

    //
    // HTTP GET route to retrieve video viewing recommendations.
    //
    app.get("/recommendations", async (req, res) => {
        const skip = parseInt(req.query.skip);
        const limit = parseInt(req.query.limit);
        const recommendations = await recommendationsCollection.find()
            .skip(skip)
            .limit(limit)
            .toArray();
        res.json({ recommendations: recommendations });
    });

    //
    // Starts the HTTP server.
    //
    app.listen(PORT, () => {
        console.log("recommendations microservice online.");
    });
}

main()
    .catch(err => {
        console.error("recommendations microservice failed to start.");
        console.error(err && err.stack || err);
    });