const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const verifyToken = async (req, res, next) => {
  console.log("inside verify token", req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "forbidden access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const propertiesCollection = client
      .db("ElyStateDB")
      .collection("properties");

    const usersCollection = client.db("ElyStateDB").collection("users");
    const wishlistCollection = client.db("ElyStateDB").collection("wishlist");
    const offersCollection = client.db("ElyStateDB").collection("offers");

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.send({ token });
    });

    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Save or modify user email, status in DB
    app.put("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = req.body;
        const query = { email: email };
        const options = { upsert: true };
        const isExist = await usersCollection.findOne(query);
        console.log("User found?----->", isExist);
        if (isExist) return res.send(isExist);
        const result = await usersCollection.updateOne(
          query,
          {
            $set: { ...user, timestamp: Date.now() },
          },
          options
        );
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    app.get("/users",verifyToken ,async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/user", async (req, res) => {
      try {
        const query = req.query.email;

        // console.log("Query --->", query);
        const result = await usersCollection.findOne({ email: query });
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    // guest crud
    app.post("/wishlist", async (req, res) => {
      try {
        const wishlist = req.body;
        const isExist = await wishlistCollection.findOne({
          property_id: wishlist.property_id,
          user_email: wishlist.user_email
        });
        console.log(isExist);
        if (!isExist) {
          const result = await wishlistCollection.insertOne(wishlist);
          return res.send({ exists: false });
        }
        res.send({ exists: true });
      } catch (err) {
        console.log(err);
      }
    });
    app.get("/wishlist",verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        if(email !== req.decoded.email){
          return res.status(401).send({ message: "forbidden access" });
        }
        if (email) {
          const query = { user_email: email };
          const result = await wishlistCollection.find(query).toArray();
          return res.send(result);
        }
        const result = await wishlistCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.get("/wishlist/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await wishlistCollection.findOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.delete("/wishlist/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await wishlistCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    app.post("/offers", async (req, res) => {
      try {
        const offer = req.body;
        const result = await offersCollection.insertOne(offer);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    app.get("/offers", async (req, res) => {
      try {
        const email = req.query.email;
        if (email) {
          const query = { buyer_email: email };
          const result = await offersCollection.find(query).toArray();
          return res.send(result);
        }
      } catch (err) {
        console.log(err);
      }
    });

    // agent cruds
    app.post("/properties", async (req, res) => {
      try {
        const property = req.body;
        const result = await propertiesCollection.insertOne(property);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    // admin cruds
    app.patch("/property/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedStatus = req.body;

        const status = {
          $set: {
            verification: updatedStatus.verification,
          },
        };
        const result = await propertiesCollection.updateOne(filter, status);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.patch("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const filter = { email: email };
        const updatedRole = req.body;
        const role = {
          $set: {
            role: updatedRole.role,
          },
        };
        const result = await usersCollection.updateOne(filter, role);
        res.send(result);
      } catch (err) {
        res.send(err);
      }
    });
    app.delete("/properties", async (req, res) => {
      try {
        const email = req.query.email;

        if (email) {
          const query = { agent_email: email };
          const result = await propertiesCollection.deleteMany(query);
          return res.send(result);
        }
      } catch (err) {
        console.log(err);
      }
    });
    app.delete("/user/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = usersCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    app.get("/offer", async (req, res) => {
      try {
        const email = req.query.email;

        if (email) {
          const query = { agent_email: email };
          const result = await offersCollection.find(query).toArray();
          return res.send(result);
        }
      } catch (err) {
        console.log(err);
      }
    });
    app.patch("/offer/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedStatus = req.body;
        const status = {
          $set: {
            status: updatedStatus.status,
          },
        };

        const result = await offersCollection.updateOne(filter, status);
        return res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //properties

    app.get("/properties", async (req, res) => {
      try {
        const email = req.query.email;

        if (email) {
          const query = { agent_email: email };
          const result = await propertiesCollection.find(query).toArray();
          return res.send(result);
        }
        const result = await propertiesCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    app.get("/property/:id", async (req, res) => {
      try {
        const id = req.params;
        const query = { _id: new ObjectId(id) };
        const result = await propertiesCollection.findOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    app.put("/property/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updatedProperty = req.body;
        const property = {
          $set: {
            title: updatedProperty.title,
            location: updatedProperty.location,
            image: updatedProperty.image,
            description: updatedProperty.description,
            price: {
              start: updatedProperty.price.start,
              end: updatedProperty.price.end,
            },
          },
        };
        const result = await propertiesCollection.updateOne(
          filter,
          property,
          options
        );
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
    app.delete("/property/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const result = await propertiesCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        res.send(err);
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from ElyState Server..");
});

app.listen(port, () => {
  console.log(`ElyState is running on port ${port}`);
});
