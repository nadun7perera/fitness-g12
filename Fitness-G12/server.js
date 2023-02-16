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
  items: Object,
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
let total = null;
// let cartTotal = null;

app.get("/", (req, res) => {
  req.session.url = "/";
  res.render("home", {
    layout: "skeleton",
    isLoggedIn: isUserLoggedIn(req.session.isLoggedIn),
  });
});

app.get("/login", (req, res) => {
  res.render("login", {
    layout: "skeleton",
    isLogin: true,
    isLoggedIn: isUserLoggedIn(req.session.isLoggedIn),
  });
});

app.post("/login", async (req, res) => {
  let user = null;
  req.session.url = "/login";
  const loginBtn = req.body.loginBtn;
  const createAccBtn = req.body.createAccBtn;

  //retrieve userEmail and password
  userEmailFromUI = req.body.userEmail;
  passwordFromUI = req.body.password;

  //login btn
  if (loginBtn === "Login") {
    let authentication = false;

    //login validation
    if (userEmailFromUI === "" && passwordFromUI === "") {
      renderError(
        res,
        "Email and Password are required",
        true,
        isUserLoggedIn(req.session.isLoggedIn)
      );
      return;
    }

    if (userEmailFromUI === "") {
      renderError(
        res,
        "Email is required",
        true,
        isUserLoggedIn(req.session.isLoggedIn)
      );
      return;
    }

    if (passwordFromUI === "") {
      renderError(
        res,
        "Password is required",
        true,
        isUserLoggedIn(req.session.isLoggedIn)
      );
      return;
    }

    try {
      user = await User.findOne({ userEmail: userEmailFromUI });
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
      req.session.userEmail = userEmailFromUI;
      req.session.userId = user.userID;
      req.session.isLoggedIn = true;

      //find all classes
      const classes = await Class.find({}).lean();
      res.render("classes", {
        layout: "skeleton",
        classList: classes,
        isLoggedIn: isUserLoggedIn(req.session.isLoggedIn),
      });

      // return userRole == appRoles.admin
      //     ? requestAdmin(): res.render("classes", { layout: "skeleton" });
    } else {
      renderError(
        res,
        "Invalid credentials Entered",
        true,
        isUserLoggedIn(req.session.isLoggedIn)
      );
    }
    //Create Account btn
  } else if (createAccBtn === "CreateAccount") {
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

  //login validation
  if (userEmailFromUI === "" && passwordFromUI === "") {
    renderError(
      res,
      "Email and Password are required",
      true,
      isUserLoggedIn(req.session.isLoggedIn)
    );
    return;
  }

  if (userEmailFromUI === "") {
    renderError(
      res,
      "Email is required",
      true,
      isUserLoggedIn(req.session.isLoggedIn)
    );
    return;
  }

  if (passwordFromUI === "") {
    renderError(
      res,
      "Password is required",
      true,
      isUserLoggedIn(req.session.isLoggedIn)
    );
    return;
  }

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
    //save to purchase collection only if the user sign up for monthly membership
    if (payment === 0) {
      await user.save();
    } else {
      await user.save();
      await purchases.save();
    }

    req.session.currentUser = userRole;
    req.session.userEmail = userEmailFromUI;
    req.session.userId = userID;
    req.session.isLoggedIn = true;

    //find all classes
    const classes = await Class.find({}).lean();

    res.render("classes", {
      layout: "skeleton",
      classList: classes,
      isLoggedIn: isUserLoggedIn(req.session.isLoggedIn),
    });
  } catch (error) {
    console.error(error);
  }
});

app.get("/classes", async (req, res) => {
  req.session.url = "/classes";
  try {
    //find all classes
    const classes = await Class.find({}).lean();

    res.render("classes", {
      layout: "skeleton",
      classList: classes,
      isLoggedIn: isUserLoggedIn(req.session.isLoggedIn),
    });
  } catch (error) {
    console.error(error);
  }
});

app.post("/classes/:classId", async (req, res) => {
  const cartID = Math.floor(Math.random() * 1000) + 1;
  // const userID = Math.floor(Math.random() * 1000) + 1;
  const listOfItems = [];

  //check if user is logged in
  if (isUserLoggedIn(req.session.isLoggedIn)) {
    try {
      //find class
      const currentClass = await Class.findOne({ classID: req.params.classId });
      const currentUser = await User.findOne({
        userEmail: req.session.userEmail,
      });
      listOfItems.push(currentClass);

      const currentCart = new Cart({
        orderID: cartID,
        userID: currentUser.userID,
        userEmail: req.session.userEmail,
        // userName: currentUser.userName,
        items: currentClass,
      });

      await currentCart.save();

      //find all classes
      //   const classes = await Class.find({}).lean();
      //   res.render("classes", {
      //     layout: "skeleton",
      //     classList: classes,
      //     isLoggedIn: isUserLoggedIn(req.session.isLoggedIn),
      //   });

      fetchCart(req, res);
    } catch (error) {
      console.error("error", error);
    }
  } else {
    renderError(
      res,
      "You need to be logged in to book classes.",
      true,
      isUserLoggedIn(req.session.isLoggedIn)
    );
  }
});

app.get("/cart", async (req, res) => {
  fetchCart(req, res);
});

app.post("/pay", async (req, res) => {
  const purchaseID = Math.floor(Math.random() * 1000) + 1;
  const orderID = `ORD-${Math.floor(Math.random() * 10000) + 1}`;

  if (isUserLoggedIn(req.session.isLoggedIn)) {
    const currentUser = await User.findOne({
      userEmail: req.session.userEmail,
    });
    isUserMemeber = currentUser.isMember;
  }

  const purchases = new Purchase({
    purchaseID: purchaseID,
    userID: req.session.userId,
    userEmail: req.session.userEmail,
    payment: req.session.cartTotal,
    // payment: 250
  });

  try {
    //save the cart total and user details to purchase collection
    await purchases.save();

    //remove all cart documents that matches the userEmail
    await Cart.remove({ userEmail: req.session.userEmail });

    res.render("confirmation", {
      layout: "skeleton",
      isLoggedIn: isUserLoggedIn(req.session.isLoggedIn),
      orderId: orderID,
    });
  } catch (error) {
    console.error(error);
  }
});

// const requestAdmin = () =>{
app.get("/admin", async (req, res) => {
  //user authorization
  if (req.session.currentUser === "admin") {
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

        //getting values from aggregate method
        totalValues
          .exec()
          .then((result) => {
            console.log("total", result[0].totalValue);
            total = result[0].totalValue;
            res.render("admin", {
              layout: "skeleton",
              purchaseList: purchaseItem,
              totalPurchase: result[0].totalValue,
              isLoggedIn: isUserLoggedIn(req.session.isLoggedIn),
            });
          })
          .catch((error) => {
            renderError(
              res,
              error,
              true,
              isUserLoggedIn(req.session.isLoggedIn)
            );
          });
      });
  } else {
    renderError(
      res,
      "Only Admin has access to this page!",
      true,
      isUserLoggedIn(req.session.isLoggedIn)
    );
  }
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
        isLoggedIn: isUserLoggedIn(req.session.isLoggedIn),
      });
    });
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.render("home", { layout: "skeleton", isLoggedIn: false });
});

app.get("/error", (req, res) => {
  if (req.session.url === "") {
    res.redirect("/");
  } else {
    res.redirect(req.session.url);
  }
});

//delete item from cart
app.post("/deleteCart/:orderId", async (req, res) => {
  console.log("order id ", req.params.orderId);

  Cart.deleteOne({ orderID: req.params.orderId })
    .exec()
    .then((result) => {
      if (result.acknowledged) {
        Cart.find({ userEmail: req.session.userEmail })
          .lean()
          .exec()
          .then((cartItem) => {
            //display error message if no items in cart
            if (cartItem.length === 0) {
              renderError(
                res,
                "Sorry, you do not have any items in the cart.",
                false,
                isUserLoggedIn(req.session.isLoggedIn)
              );
              return;
            }

            fetchCart(req, res);
          });
      }
    });
});

//const fetchcart
const fetchCart = async (req, res) => {
  let taxPercentage = 0.1; //i.e 10% (10/100 = 0.1)

  let isUserMemeber = false;
  if (isUserLoggedIn(req.session.isLoggedIn)) {
    const currentUser = await User.findOne({
      userEmail: req.session.userEmail,
    });
    isUserMemeber = currentUser.isMember;
  }

  // const carts = await Cart.find({ userEmail: req.session.userEmail }).lean()
  await Cart.find({ userEmail: req.session.userEmail })
    .lean()
    .exec()
    .then((cartItem) => {
      //display error message if no items in cart
      if (cartItem.length === 0) {
        renderError(
          res,
          "Sorry, you do not have any items in the cart.",
          false,
          isUserLoggedIn(req.session.isLoggedIn)
        );
        return;
      }

      // sum all the values to show total
      const totalValues = Cart.aggregate([
        { $match: { userEmail: req.session.userEmail } },
        { $group: { _id: null, total: { $sum: "$items.price" } } },
      ]);

      console.log("total", totalValues);

      //getting values from aggregate method
      totalValues
        .exec()
        .then((result) => {
          console.log("total", result);
          const taxValue = result[0].total * taxPercentage;
          res.render("cart", {
            layout: "skeleton",
            userEmail: req.session.userEmail,
            isLoggedIn: isUserLoggedIn(req.session.isLoggedIn),
            isMember: isUserMemeber,
            cartList: cartItem,
            subTotal: result[0].total,
            taxValue: taxValue,
            totalValue: result[0].total + taxValue,
          });
        })
        .catch((error) => {
          renderError(res, error);
        });
    });
};

//function to create error message UI
const renderError = (res, message, isGoBackBtn, isLoggedIn) => {
  return res.render("error", {
    layout: "skeleton",
    message: message,
    isGoBackBtn: isGoBackBtn,
    isLoggedIn: isLoggedIn,
  });
};

//function to check if the user is logged in
const isUserLoggedIn = (isLogged) => {
  if (isLogged) {
    return true;
  } else {
    return false;
  }
};

const onHttpStart = () => {
  console.log(
    `Web server started on port ${HTTP_PORT}, press CTRL + c to exit`
  );
};

app.listen(HTTP_PORT, onHttpStart);
