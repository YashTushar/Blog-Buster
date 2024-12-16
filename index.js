const express = require("express");
const bycrpt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const path = require("path");
const app = express();
const userSchema = require("./models/user");
const postSchema = require("./models/post");
const moment = require("moment");
const upload = require("./config/multerconfig");
const mongoose = require("mongoose");
let dotenv = require("dotenv");
dotenv.config();
mongoose.connect(process.env.URI);
// console.log(process.env.URI);
let bpath;
let dv = "nf";
let lv = "rel";
let msg = "";
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("landing");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/login", (req, res) => {
  //console.log(req.cookies.token);
  if (req.cookies.token == null) res.render("login");
  if (req.cookies.token != "") res.redirect("/feed");
  res.render("login");
});

app.get("/profile", isLoggedin, async (req, res) => {
  // console.log(req.user);
  let user = await userSchema
    .findOne({ email: req.user.email })
    .populate("posts");
  await user.save();
  let allusers = await userSchema.find();
  res.render("profile", { user, allusers });
});

app.get("/:type/profile/:uname", isLoggedin, async (req, res) => {
  // console.log(req.user);
  let user = await userSchema
    .findOne({ username: req.params.uname })
    .populate("posts");
  let visitor = await userSchema.findOne({ email: req.user.email });
  await user.save();
  //console.log(user);
  if (req.params.type == "user") {
    bpath = "profile";
    res.render("viewprofile", { user, visitor, bpath });
  } else {
    bpath = "feed";
    res.render("viewprofile", { user, visitor, bpath });
  }
});

app.get("/profile/:source/:uname/:pid", isLoggedin, async (req, res) => {
  let user = await userSchema.findOne({ email: req.user.email });
  let post = await postSchema.findOne({ _id: req.params.pid });
  if (post.likes.includes(user._id)) {
    post.likes.remove(user._id);
    post.size--;
  } else {
    post.likes.push(user._id);
    post.size++;
  }
  await post.save();
  if (req.params.source == "feed") {
    res.redirect("/feed");
  } else if (req.params.source == "owner") {
    res.redirect(`/profile`);
  } else if (req.params.source == "search") {
    res.redirect("/search");
  } else {
    if (bpath == "profile") res.redirect(`/user/profile/${req.params.uname}`);
    else res.redirect(`/feed/profile/${req.params.uname}`);
  }
});

app.get("/edit/:pid", isLoggedin, async (req, res) => {
  let post = await postSchema.findOne({ _id: req.params.pid });
  let user = await userSchema.findOne({ email: req.user.email });
  res.render("edit", { user, post });
});

app.get("/delete/:pid", isLoggedin, async (req, res) => {
  let post = await postSchema.findOneAndDelete({ _id: req.params.pid });
  let user = await userSchema.findOne({ email: req.user.email });
  user = await user.updateOne({ $pull: { posts: req.params.pid } });
  res.redirect("/profile");
});

app.get("/profile/update", isLoggedin, (req, res) => {
  res.render("updateprofile");
});

app.post(
  "/updatepp",
  isLoggedin,
  upload.single("image"),
  async (req, res, next) => {
    let user = await userSchema.findOne({ email: req.user.email });
    //console.log(user);
    user.profilepic = req.file.filename;
    await user.save();
    res.redirect("/profile");
  }
);

app.post("/signup", async (req, res) => {
  let { username, name, age, email, password } = req.body;
  let val = await userSchema.findOne({ email });
  if (val == null) {
    bycrpt.genSalt(10, (err, salt) => {
      bycrpt.hash(password, salt, async (err, hash) => {
        let newuser = await userSchema.create({
          username,
          name,
          age,
          email,
          password: hash,
        });

        let token = jwt.sign({ email, id: newuser._id }, "shhhhh");
        res.cookie("token", token);
        res.redirect("/feed");
      });
    });
  } else {
    let msg = "User Already Exists !!";
    res.render("Error", { msg, url: req.url });
  }
});

app.post("/login", async (req, res) => {
  let { email, password } = req.body;
  let val = await userSchema.findOne({ email });
  let msg = "Invalid Email-ID or password";
  if (val == null) res.render("error", { msg, url: req.url });
  if (val) {
    bycrpt.compare(password, val.password, (err, result) => {
      if (result) {
        let token = jwt.sign({ email, id: val._id }, "shhhhh");
        res.cookie("token", token);
        res.redirect("/feed");
      } else {
        res.render("error", { msg, url: req.url });
      }
    });
  }
});

app.post("/post", isLoggedin, async (req, res) => {
  let user = await userSchema.findOne({ email: req.user.email });
  let post = await postSchema.create({
    user: user._id,
    username: user.username,
    content: req.body.content,
  });
  user.posts.push(post._id);
  await user.save();
  res.redirect("/feed");
});

app.post("/edit/:pid", isLoggedin, async (req, res) => {
  let post = await postSchema.findOneAndUpdate(
    { _id: req.params.pid },
    { content: req.body.content, date: Date.now(), edited: true },
    { new: true }
  );
  let user = await userSchema.findOne({ email: req.user.email });
  // console.log(post);
  res.redirect("/profile");
});

app.post("/search", isLoggedin, async (req, res) => {
  let posts = await postSchema
    .find({ $text: { $search: req.body.search } })
    .populate("user")
    .sort({ date: -1 });
  let visitor = await userSchema.findOne({ email: req.user.email });
  msg = req.body.search;
  if (posts.length == 0) {
    res.render("noresult");
  }
  dv = "nf";
  lv = "rel";
  res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  // console.log(posts);
});

app.get("/search", isLoggedin, async (req, res) => {
  let visitor = await userSchema.findOne({ email: req.user.email });
  if (dv == "nf" && lv == "ml") {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ size: -1, date: -1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  } else if (dv == "nf" && lv == "ll") {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ size: 1, date: -1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  } else if (dv == "of" && lv == "ml") {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ size: -1, date: 1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  } else if (dv == "of" && lv == "ll") {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ size: 1, date: 1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  } else if (dv == "of") {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ date: 1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  } else {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ date: -1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  }
});

app.get("/logout", (req, res) => {
  res.cookie("token", "");
  res.redirect("/");
});

app.get("/nsos", (req, res) => {
  res.render("noresult");
});

function isLoggedin(req, res, next) {
  if (req.cookies.token == null || req.cookies.token === "") {
    let msg = "Please Login First !!";
    res.render("error", { msg, url: "login" });
  } else {
    let data = jwt.verify(req.cookies.token, "shhhhh");
    req.user = data;
    next();
  }
}

app.get("/feed", isLoggedin, async (req, res) => {
  let posts = await postSchema.find({}).populate("user").sort({ date: -1 });
  // console.log(posts);
  let visitor = await userSchema.findOne({ email: req.user.email });
  dv = "nf";
  lv = "rel";
  res.render("feed", { posts, visitor, moment, dv, lv });
});

app.post("/apply", isLoggedin, async (req, res) => {
  //console.log(req.body);
  // res.redirect('/feed');
  let visitor = await userSchema.findOne({ email: req.user.email });
  dv = req.body.date;
  lv = req.body.like;
  if (dv == "nf" && lv == "ml") {
    let posts = await postSchema
      .find({})
      .populate("user")
      .sort({ size: -1, date: -1 });
    res.render("feed", { posts, visitor, moment, dv, lv });
  } else if (dv == "nf" && lv == "ll") {
    let posts = await postSchema
      .find({})
      .populate("user")
      .sort({ size: 1, date: -1 });
    res.render("feed", { posts, visitor, moment, dv, lv });
  } else if (dv == "of" && lv == "ml") {
    let posts = await postSchema
      .find({})
      .populate("user")
      .sort({ size: -1, date: 1 });
    res.render("feed", { posts, visitor, moment, dv, lv });
  } else if (dv == "of" && lv == "ll") {
    let posts = await postSchema
      .find({})
      .populate("user")
      .sort({ size: 1, date: 1 });
    res.render("feed", { posts, visitor, moment, dv, lv });
  } else if (dv == "of") {
    let posts = await postSchema.find({}).populate("user").sort({ date: 1 });
    res.render("feed", { posts, visitor, moment, dv, lv });
  } else {
    let posts = await postSchema.find({}).populate("user").sort({ date: -1 });
    res.render("feed", { posts, visitor, moment, dv, lv });
  }
});
app.post("/:msg/sapply", isLoggedin, async (req, res) => {
  //console.log(req.body);
  // res.redirect('/feed');
  let visitor = await userSchema.findOne({ email: req.user.email });
  dv = req.body.date;
  lv = req.body.like;
  msg = req.params.msg;
  if (dv == "nf" && lv == "ml") {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ size: -1, date: -1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  } else if (dv == "nf" && lv == "ll") {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ size: 1, date: -1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  } else if (dv == "of" && lv == "ml") {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ size: -1, date: 1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  } else if (dv == "of" && lv == "ll") {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ size: 1, date: 1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  } else if (dv == "of") {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ date: 1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  } else {
    let posts = await postSchema
      .find({ $text: { $search: msg } })
      .populate("user")
      .sort({ date: -1 });
    res.render("sresult", { posts, visitor, msg, moment, dv, lv });
  }
});
app.get("*", (req, res) => {
  res.status(404).render("e404");
});

app.listen(3000, (err) => {
  if (err) console.log(err);
  console.log("Server is Servering");
});
