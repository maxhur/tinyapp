const cookieSession = require('cookie-session');
const express = require("express");
const bcrypt = require("bcryptjs");
const app = express();
const PORT = 8080;
const { getUserByEmail, findUsersByID, urlsForUser, equalShortURL, generateRandomString } = require("./helpers.js");
const { users } = require("./server-data/user_info.js");
const { urlDatabase } = require("./server-data/database.js");

// after submitting the POST request, the data is sent as a buffer.
// This line is to read that data.
// if req.body is undefined, this line might be wrong.
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'session',
  keys: ['key1', 'key2', 'key3'],

  // Cookie Options
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

//tells the express app to use EJS as its templating engine
app.set("view engine", "ejs");


app.get("/", (req, res) => {
  return res.redirect("/urls");
});


app.get("/urls.json", (req, res) => {
  return res.json(urlDatabase);
});

////////////////////// a route for /urls
app.get("/urls", (req, res) => {
  const foundUserInfo = findUsersByID(req.session["user_id"], users);
  if (!foundUserInfo) {
    return res.send('<h1>Please login or register</h1><form method="GET" action="/login"><button type="submit" class="btn btn-outline-primary">Login</button></form><form method="GET" action="/register"><button type="submit" class="btn btn-outline-primary">Register</button></form>');
  }
  // find the block of object
  const templateVars = {
    user: foundUserInfo,
    urls: urlsForUser(urlDatabase, foundUserInfo.id)
  };
  return res.render("urls_index", templateVars);
});

////////////////////// adds a new route(page) to submit long url
app.get("/urls/new", (req, res) => {
  const foundUserInfo = findUsersByID(req.session["user_id"], users);
  // find the block of object
  const templateVars = {
    user: foundUserInfo
  };
  if (!templateVars.user) {
    return res.redirect("/login");
  }
  return res.render("urls_new", templateVars);
});

////////////////////// CREATE A NEW SHORT URL FOR LONG URL REQUEST
app.post("/urls", (req, res) => {
  if (!req.session.user_id) {
    return res.send('You cannot create new shortened URL if you are not logged in.');
  }
  // response after a submit button if user is logged in
  const shortURL = generateRandomString();
  urlDatabase[shortURL] = {
    longURL: req.body.longURL,
    userID: req.session.user_id
  };
  return res.redirect(`/urls/${shortURL}`);
});


////////////////////// added a another route for /urls/:id; ":" tells that id is a route parameter
app.get("/urls/:id", (req, res) => {
  const foundUserInfo = findUsersByID(req.session["user_id"], users);
  // error message if not logged in
  if (!foundUserInfo) {
    return res.send('<html><head><title>NOPE</title></head><body><h1>Please login or register</h1></body><form method="GET" action="/login"><button type="submit" class="btn btn-outline-primary">login</button></form><form method="GET" action="/register"><button type="submit" class="btn btn-outline-primary">Register</button></form></html>');
  }
  // find the block of object
  // const urls = urlsForUser(urlDatabase, foundUserInfo.id);
  if (urlDatabase[req.params.id].userID === foundUserInfo.id) {
    const templateVars = {
      shortURL: req.params.id,
      user: foundUserInfo,
      urls: urlDatabase[req.params.id],
    };
    return res.render("urls_show", templateVars);
  }
  return res.send("not found");
});

////////////////////// EDIT REQUEST
app.post("/urls/:id", (req, res) => {
  const shotURLID = req.params.id;
  if (!req.session.user_id || equalShortURL(urlDatabase, shotURLID)) {
    return res.send('You cannot create new shortened URL if you are not logged in.');
  }
  urlDatabase[shotURLID] = {
    longURL: req.body.longURL,
    userID: req.session.user_id
  };
  return res.redirect(`/urls/${shotURLID}`);
});

////////////////////// redirects to the longURL page when clicked
app.get("/u/:id", (req, res) => {
  const shortURL = req.params.id;
  const longURL = urlDatabase[shortURL].longURL;
  if (shortURL && longURL) {
    return res.redirect(longURL);
  }
  return res.send(`The ${shortURL} does not exist`);
});


////////////////////// DELTE REQUEST
app.post("/urls/:id/delete", (req, res) => {
  const shortURLID = req.params.id;
  if (!req.session.user_id || equalShortURL(urlDatabase, shortURLID)) {
    return res.send('Error. You are trying to delete an URL that does not exist or that you are not signed in.');
  }
  delete urlDatabase[shortURLID];
  return res.redirect("/urls");
});


////////////////////// register route
app.get("/register", (req, res) => {
  const templateVars = {
    user: req.session["user_id"]
  };
  // if the user is logged in, go to /urls otherwise to /register
  if (templateVars.user) {
    return res.redirect("/urls");
  }
  return res.render("register", templateVars);
});

////////////////////// REGISTER REQUEST
app.post("/register", (req, res) => {
  const randomUserID = generateRandomString();
  const newUserEmail = req.body.newUserEmail;
  const newUserPassword = req.body.inputPassword;
  // check if both input is not empty
  if (!newUserEmail || !newUserPassword) {
    return res.send('Must fill out Email and Password');
  }
  const hashedPassword = bcrypt.hashSync(newUserPassword, 10);
  const newUserInfo = {
    id: randomUserID,
    email: newUserEmail,
    password: hashedPassword
  };
  if (!getUserByEmail(newUserEmail, users)) {
    users[randomUserID] = newUserInfo;
  } else {
    return res.send('403: Forbidden');
  }
  console.log("New User registered!");
  req.session.user_id = randomUserID;
  return res.redirect("/urls");
});


////////////////////// a login route
app.get("/login", (req, res) => {
  const userID = req.session["user_id"];
  const user = users[userID];

  const templateVars = {
    user: req.session["user_id"]
  };
  // if the user is logged in, go to /urls otherwise to /login
  if (user) {
    return res.redirect("/urls");
  }
  return res.render("login_page", templateVars);
});

////////////////////// SIGN IN REQUEST
app.post("/login", (req, res) => {
  const foundUser = getUserByEmail(req.body.email, users);
  if (foundUser) {
    // if encrypted input pass matches encrypted stored pass, go ahead.
    if (bcrypt.compareSync(req.body.inputPassword, foundUser.password)) {
      const userID = foundUser.id;
      req.session.user_id = userID;
      return res.redirect("/urls");
    }
  }
  return res.send('403: Forbidden');
});

////////////////////// LOGOUT REQUEST
app.post("/logout", (req, res) => {
  req.session = null;
  return res.redirect("/login");
});

// sends a message to conosle that server is running
app.listen(PORT, () => {
  return console.log(`Example app listening on port${PORT}!`);
});