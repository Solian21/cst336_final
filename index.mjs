import express from 'express';
import session from "express-session";
import mysql from 'mysql2/promise';
import bcrypt from "bcrypt";
const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));

app.use(session({
   secret: 'keyboard cat',
   resave: false,
   saveUninitialized: true
}))

app.use((req, res, next) => {
   res.locals.user = req.session.user;
   next();
});

function requireAuth(req, res, next) {
   if (!req.session.user) {
      return res.redirect("/signin");
   }
   next();
}

function requireAdmin(req, res, next) {
   if (!req.session.user || !req.session.user.isAdmin) {
      return res.redirect("/signin");
   }
   next();
}

const pool = mysql.createPool({
   host: "r4wkv4apxn9btls2.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
   user: "q6yul0pqho3zk1w0",
   password: "yobxlyfihnpphrxe",
   database: "ml93a3z99zh2rspl",
   connectionLimit: 10,
   waitForConnections: true
});

app.get('/', async (req, res) => {
   const options = {
      method: 'GET',
      headers: {
         accept: 'application/json',
         Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxZjcyZTdhNTg3OGJhNTYyOGJmMDgzNWNhNGZjMGNmYyIsIm5iZiI6MTc3NDM3MDM4MC4zOCwic3ViIjoiNjljMmJlNGNkOWVlMGEyZGJiN2JjYzMwIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.A6PJgrCtyusFUW9ueoWDMma1nNUU0e_5C-ZDyYg8ye8'
      }
   };

   const response = await fetch('https://api.themoviedb.org/3/discover/movie', options);
   const data = await response.json();
   const movies = data.results;
   const randomMovie = movies[Math.floor(Math.random() * movies.length)];

   res.render("home.ejs", { movie: randomMovie });
});


// Registration and login routes

app.get('/signup', (req, res) => {
   res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
   const { username, password } = req.body;
   try {
      const [existing] = await pool.query(
         "SELECT userId FROM users WHERE username = ?",
         [username]
      );
      if (existing.length > 0) {
         return res.render('signup', { error: "Username already exists!" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      let sqlParameters = [username, hashedPassword];
      let sql = `
        INSERT INTO users (username, password, isAdmin) 
        VALUES (?, ?, 0)`;
      await pool.query(sql, sqlParameters);

      res.redirect('/');
   } catch (err) {
      console.error("Registration error:", err);
      res.render('signup', { error: "Registration error!" });
   }
});

app.get('/signin', (req, res) => {
   res.render('signin', { error: null });
});

app.post('/signin', async (req, res) => {
   const { username, password } = req.body;
   try {
      const [rows] = await pool.query("SELECT username, password FROM users WHERE username = ?", [username]);
      if (rows.length === 0) {
         return res.render('signin', { error: "Invalid username or password!" });
      }
      const user = rows[0];
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
         return res.status(401).send("Invalid username or password!");
      }
      req.session.user = user;
      res.redirect('/');
   } catch (err) {
      console.error("Login error:", err);
      res.render('signin', { error: "Login error!" });
   }
});

app.get('/logout', (req, res) => {
   req.session.destroy();
   res.redirect('/');
});


app.get('/search', async (req, res) => {
   // -----API STUFF -------
   const options = {
      method: 'GET',
      headers: {
         accept: 'application/json',
         Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxZjcyZTdhNTg3OGJhNTYyOGJmMDgzNWNhNGZjMGNmYyIsIm5iZiI6MTc3NDM3MDM4MC4zOCwic3ViIjoiNjljMmJlNGNkOWVlMGEyZGJiN2JjYzMwIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.A6PJgrCtyusFUW9ueoWDMma1nNUU0e_5C-ZDyYg8ye8'
      }
   };

   //   ----MOVIE API SEARCH STUFF -----
   const user_search = req.query.search || "";// search is the name of the input name in navbar.ejs

   const movies = [];

   if (user_search.trim() !== "") {
      const response = await fetch(
         `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(user_search)}&include_adult=false&language=en-US&page=1`,
         options
      );


      const data = await response.json();

      data.results.forEach(item => {
         if (!item.poster_path) return;

         movies.push({
            title: item.title || item.name || "Untitled",
            posterPath: item.poster_path,
            overview: item.overview || "No description available."
         });
      });
   }

   console.log("Movies sent to search page:", movies);



   res.render("search.ejs", { movies });
});

app.listen(3000, () => {
   console.log('server started');
});