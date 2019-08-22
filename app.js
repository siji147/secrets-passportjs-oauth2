//jshint esversion:6


require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

//#region Hashing and Salting
// const bcrypt = require("bcrypt");
// const saltRounds = 0;
//#endregion


//#region Hashing
//const md5 = require('md5');
//#endregion


//#region Basic encryption
//const encrypt = require("mongoose-encryption");
//#endregion


const app = express();


app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", { useNewUrlParser: true });
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secrets: [String]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
//userSchema.plugin(encrypt, { secret: process.env.SECRET, encryptedFields: ['password'] });

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        //console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile"] })
);

app.get('/auth/google/secrets', 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets page.
    res.redirect("/secrets");
  });

app.get("/login", function (req, res) {
    //console.log(req.headers.referer);
    res.render("login");
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/secrets", function (req, res) {
   User.find({"secrets": {$ne:null}}, function(err, foundUsers){
       if (err){
           console.log(err);
       }
       else{
           if(foundUsers){
               res.render("secrets", {usersWithSecrets: foundUsers});
           }
       }
   });
});

app.get("/submit", function(req, res){
    if(req.isAuthenticated()){
        res.render("submit");
    }
    else{
        res.redirect("/login");
    }
});

app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret;
    //console.log(req.user.id);

    User.findById(req.user.id, function(err, foundUser){
        if(err){
            console.log();
        }
        else{
            if (foundUser){
                foundUser.secrets.push(submittedSecret);
                foundUser.save();
                res.redirect("/secrets");
            }
        }
    });
});

app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});


app.post("/register", function (req, res) {

    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/");
        }
        else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    });

    //#region UsingHashAndSalting
    // bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
    //     const newUser = new User({
    //         email: req.body.username,
    //         password: hash

    //         // Hashing only
    //         //password: md5(req.body.password)
    //     });
    //     newUser.save(function (err) {
    //         if (err) {
    //             console.log(err);
    //         }
    //         else {
    //             res.render("secrets");
    //         }
    //     });
    // });

    //#endregion



});

app.post("/login", function (req, res) {

    //console.log(req);
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function (err) {
        if (err) {
            console.log(err);
        }
        else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            });
        }
    });

    //#region UsingHashAndSalting
    // const username = req.body.username;
    // //const password = md5(req.body.password);



    // User.findOne({ email: username }, function (err, foundUser) {
    //     if (err) {
    //         console.log(err);
    //     }
    //     else {
    //         if (foundUser) {
    //             bcrypt.compare(req.body.password, foundUser.password, function (err, result) {
    //                 if (result === true) {
    //                     res.render("secrets");
    //                 }
    //                 else {
    //                     res.send("Invalid Password entered!");
    //                 }
    //             });
    //         }


    //         // if (foundUser) {
    //         //     if (foundUser.password == password) {
    //         //         res.render("secrets");
    //         //     }
    //     }

    // });
    //#endregion

});

























app.listen(3000, function () {
    console.log("Server is listening on port 3000");
});