const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');

const port = process.env.PORT || 5000

// doctors-portal-firebase-adminsdk.json
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yi4wr.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

// console.log(uri);

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            // check who want to make someone as admin --> store his(who want to try make other admin) mail address in decodedEmail
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {
            
        }
    }
    next();
}

async function run() {
    try {
        await client.connect();
        // console.log('database connected successfully');

        const database = client.db('doctors_portal');
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');
        
        // app.get('/users) --> database theke user k nibo
        app.get('/appointments', verifyToken, async (req, res) => {
            // get data with filtering by email & date
            const email = req.query.email;
                        
            //new
            const date = req.query.date;

            // old --> date couldn't find properly cz of time zone...
            // const date = new Date(req.query.date).toLocaleDateString();
            // console.log(date);

            const query = {email: email, date: date}
            const cursor = appointmentsCollection.find(query);
            
            /* 
            // get all data without filtering
            const cursor = appointmentsCollection.find({});
            */
            const appointments = await cursor.toArray();
            res.json(appointments);
        })

        // app.get('/users/:id) --> database theke specific kiso diye user k nibo

        // app.post('users') --> database ee 1ta user k add korbo
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            // console.log(appointment);

            const result = await appointmentsCollection.insertOne(appointment);
            console.log(result);

            res.json(result);
        })

        // check an user is he/she admin or not
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        // add user in my db
        app.post('/users', async (req, res) => {
            const user = req.body;
            // console.log(user);

            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result);
        })

        // add user by upsert( update & insert ) method
        app.put('/users', async (req, res) => {
            const user = req.body;
            // console.log('put', user);

            // check is this user already registered?
            const filter = { email: user.email };

            // this option instructs the method to create a document if no documents match the filter
            const options = { upsert: true };

            const updateDoc = { $set: user };

            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        })

        // app.put('/users/:id') --> update user by specific id/email
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            // console.log('put', req.decodedEmail);
            const requester = req.decodedEmail; // who want to try someone make admin

            if (requester) {
                // at first find this user from my database
                const requesterAccount = await usersCollection.findOne({ email: requester });

                // now check is his role is admin or not in my db
                if (requesterAccount.role === 'admin') {
                    // if his role is admin then he can add someone as admin

                    // find this user which we want to make admin
                    const filter = { email: user.email }

                    // update this user...
                    const updateDoc = { $set: { role: 'admin' } };

                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' });
            }

            /* // find this user which we want to make admin
            const filter = { email: user.email }

            // update this user...
            const updateDoc = { $set: { role: 'admin' } };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.json(result); */
        })

        // app.delete('user/:id') --> database theke specific id diye user k delete korbo

    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Doctors portal!')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})


// app.get('/users) --> database theke user k nibo
// app.get('/users/:id) --> database theke specific kiso diye user k nibo
// app.post('users') --> database ee 1ta user k add korbo
// app.put('/users/:id') --> update user by specific id
// app.delete('user/:id') --> database theke specific id diye user k delete korbo