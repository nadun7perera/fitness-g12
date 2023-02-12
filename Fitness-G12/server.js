const express = require("express");
const app = express();
app.use(express.static("assets"));

const HTTP_PORT = process.env.PORT || 8080;

const exphbs = require("express-handlebars");
app.engine(
  ".hbs",
  exphbs.engine({
    extname: ".hbs",
    helpers: {
      json: (context) => {
        return JSON.stringify(context);
      },
    },
  })
);
app.set("view engine", ".hbs");

app.use(express.static("assets"));
app.use(express.urlencoded({ extended: true }));

// setup sessions
const session = require("express-session");
app.use(
  session({
    secret: "the quick brown fox jumped over the lazy dog 1234567890", // random string, used for configuring the session
    resave: false,
    saveUninitialized: true,
  })
);

const mongoose = require("mongoose");

// connect to db
mongoose.connect("mongodb://127.0.0.1:27017/fitnessStudioDB", {
  useNewUrlParser: true,
});

//const roles
const appRoles = {
  admin: "admin",
  user: "user",
};

// Define the schema for the collection
const userSchema = new mongoose.Schema({
  userID: Number,
  role: String,
  userEmail: String,
  password: String,
  isMember: Boolean,
});

const classSchema = new mongoose.Schema({
  classID: Number,
  className: String,
  instructor: String,
  classLength: String,
  price: Number,
});

const purchaseSchema = new mongoose.Schema({
  purchaseID: Number,
  userID: Number,
  userEmail: String,
  payment: Number,
});

const cartSchema = new mongoose.Schema({
  orderID: Number,
  userID: Number,
  userEmail: String,
  userName: String,
  items: Array,
});

// Compile the schema into a model
const User = mongoose.model("User", userSchema);
const Class = mongoose.model("Class", classSchema);
const Purchase = mongoose.model("Purchase", purchaseSchema);
const Cart = mongoose.model("Cart", cartSchema);

//global variables
let userEmailFromUI = null;
let passwordFromUI = null;
let userRole = null;
var total = null;

// // Create a new user document
// async function createUser() {
//     try {
//         const user = await User.findOne({ role: 'Admin' });
//         if (user === null) {
//             const user = new User({
//                 userID: 0001,
//                 role: 'Admin',
//                 userEmail: 'admin@fitness.com',
//                 password: 'admin@789',
//             });
//             await user.save();
//             console.log(`User created: ${user}`);
//         }
//     } catch (error) {
//         console.error(error);
//     }
// }

app.get("/", (req, res) => {
  res.render("home", { layout: "skeleton" });
});

app.get("/classes", (req, res) => {
  res.render("classes", { layout: "skeleton" });
});

app.get("/cart", (req, res) => {
  res.render("cart", { layout: "skeleton" });
});

app.get("/login", (req, res) => {
  res.render("login", { layout: "skeleton", isLogin: true });
});

app.post("/login", async (req, res) => {
  const loginBtn = req.body.loginBtn;
  const createAccBtn = req.body.createAccBtn;

  //retrieve userEmail and password
  userEmailFromUI = req.body.userEmail;
  passwordFromUI = req.body.password;

  //login btn
  if (loginBtn === "Login") {
    let authentication = false;
    try {
      const user = await User.findOne({ userEmail: userEmailFromUI });
      if (user !== null) {
        if (user.password === passwordFromUI) {
          authentication = true;
          userRole = user.role.toLowerCase();
        }
      }
    } catch (error) {
      console.error(error);
    }

    //if userEmail and password matches, then create the session and log in the user
    if (authentication === true) {
      req.session.currentUser = userRole;
      req.session.isLoggedIn = true;

      console.log("[/login] What is the contents of req.session?");
      console.log(req.session);
      console.log(req.session.currentUser);

      return userRole == appRoles.admin
        ? requestAdmin()
        : res.render("classes", { layout: "skeleton" });
    } else {
      return res.send("ERROR: Invalid credentials!");
    }
    //Create Account btn
  } else if (createAccBtn === "Create Account") {
    res.render("login", { layout: "skeleton", isLogin: false });
  }
});

app.post("/signup", async (req, res) => {
  let isMember = false;
  let payment = 0;
  const memberBtn = req.body.memberBtn;
  const userID = Math.floor(Math.random() * 1000) + 1;
  const purchaseID = Math.floor(Math.random() * 1000) + 1;
  // const noMemberBtn = req.body.noMemberBtn

  if (memberBtn === "Yes") {
    isMember = true;
    payment = 75;
  }

  const user = new User({
    userID: userID,
    role: "User",
    userEmail: userEmailFromUI,
    password: passwordFromUI,
    isMember: isMember,
  });

  const purchases = new Purchase({
    purchaseID: purchaseID,
    userID: userID,
    userEmail: userEmailFromUI,
    payment: payment,
  });

  try {
    await user.save();
    await purchases.save();
    console.log(`User created: ${user}`);
    console.log(`Purchase created: ${purchases}`);
  } catch (error) {
    console.error(error);
  }

  res.render("classes", { layout: "skeleton" });
});

// const requestAdmin = () =>{
app.get("/admin", async (req, res) => {
  Purchase.find({})
    .lean()
    .then((purchaseItem) => {
      //sum up all the values
      const totalValues = Purchase.aggregate([
        {
          $group: {
            _id: null,
            totalValue: { $sum: "$payment" },
          },
        },
      ]);

      //getting values from aggregate metod
      totalValues
        .exec()
        .then((result) => {
          console.log("total", result[0].totalValue);
          total = result[0].totalValue;
          res.render("admin", {
            layout: "skeleton",
            purchaseList: purchaseItem,
            totalPurchase: result[0].totalValue,
          });
        })
        .catch((error) => {
          res.send("error occured while fetching values");
        });
    });
});

app.post("/filterAdmin", async (req, res) => {
  Purchase.find({})
    .sort({ userEmail: 1 })
    .lean()
    .exec()
    .then((result) => {
      res.render("admin", {
        layout: "skeleton",
        purchaseList: result,
        totalPurchase: total,
      });
    });
});

const onHttpStart = () => {
  console.log(
    `Web server started on port ${HTTP_PORT}, press CTRL + c to exit`
  );
};

app.listen(HTTP_PORT, onHttpStart);
