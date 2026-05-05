import express from 'express';
import session from "express-session";
import mysql from 'mysql2/promise';
import bcrypt from "bcrypt";
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const Ai = new GoogleGenAI({
   apiKey: process.env.AI_KEY
});

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

app.use(express.json());

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
   const { username, password, makeAdmin } = req.body;
   const isAdmin = makeAdmin === "true" ? 1 : 0;
   try {
      const [existing] = await pool.query(
         "SELECT userId FROM users WHERE username = ?",
         [username]
      );
      if (existing.length > 0) {
         return res.render('signup', { error: "Username already exists!" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      let sqlParameters = [username, hashedPassword, isAdmin];
      let sql = `
        INSERT INTO users (username, password, isAdmin) 
        VALUES (?, ?, ?)`;
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
      const [rows] = await pool.query("SELECT userId, username, password, isAdmin FROM users WHERE username = ?", [username]);
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

app.get('/edit-account', requireAuth, async (req, res) => {
   let sql = `
      SELECT username
      FROM users
      WHERE userId = ?`
   const [rows] = await pool.query(sql, [req.session.user.userId]);
   let user = rows[0];
   res.render('edit_account', {user, errorusername:false, errorpassword:false});
});

app.post('/edit-username', requireAuth, async (req, res) => {
   const {user, username} = req.body;
   let sqlVerify = `
      SELECT userId
      FROM users
      WHERE username = ?`
   const [rows] = await pool.query(sqlVerify, [username]);
   if (rows.length != 0) {
      res.render('edit_account', {user, errorusername:true, errorpassword:false});
      return;
   }
   let sql = `
      UPDATE users
      SET username = ?
      WHERE userId = ?`
   await pool.query(sql, [username, req.session.user.userId]);
   res.redirect('/')
});

app.post('/edit-password', requireAuth, async (req, res) => {
   const {user, oldpassword, newpassword} = req.body;
   let sqlVerify = `
      SELECT password
      FROM users
      WHERE userId = ?`
   const [rows] = await pool.query(sqlVerify, [req.session.user.userId]);
   let password = rows[0].password;
   const passwordMatch = await bcrypt.compare(oldpassword, password);
   if (!passwordMatch) {
      res.render('edit_account', {user, errorusername:false, errorpassword:true});
      return;
   }
   let sql = `
      UPDATE users
      SET password = ?
      WHERE userId = ?`
   const hashedPassword = await bcrypt.hash(newpassword, 10);
   await pool.query(sql, [hashedPassword, req.session.user.userId]);
   res.redirect('/')
});

app.get('/logout', (req, res) => {
   req.session.destroy();
   res.redirect('/');
});

app.get('/admin', requireAdmin, async (req, res) => {
   const userSearch = req.query.userSearch || "";
   let foundUser = null;
   let userWatchlist = [];

   if (userSearch.trim() !== "") {
      const [rows] = await pool.query(
         `SELECT userId, username, isAdmin
          FROM users
          WHERE username = ?`,
         [userSearch]
      );

      if (rows.length > 0) {
         foundUser = rows[0];

         const [watchlistRows] = await pool.query(
            `SELECT watchlistId, movieId, title, posterPath, overview, dateAdded
             FROM watchlist
             WHERE userId = ?
             ORDER BY dateAdded ASC`,
            [foundUser.userId]
         );

         userWatchlist = watchlistRows;
      }
   }

   res.render('admin.ejs', { foundUser, userSearch, userWatchlist });
});

app.post('/admin/updateAdmin', requireAdmin, async (req, res) => {
   const { userId, userSearch, isAdmin } = req.body;

   const newAdminValue = isAdmin === "on" ? 1 : 0;

   //Not needed but prevents admins from removing themselves
   if (Number(userId) === req.session.user.userId && newAdminValue === 0) {
      return res.redirect(`/admin?userSearch=${encodeURIComponent(userSearch)}`);
   }

   await pool.query(
      `UPDATE users
       SET isAdmin = ?
       WHERE userId = ?`,
      [newAdminValue, userId]
   );

   res.redirect(`/admin?userSearch=${encodeURIComponent(userSearch)}`);
});

app.post('/admin/removeWatchlistMovie', requireAdmin, async (req, res) => {
   const { watchlistId, userSearch } = req.body;

   await pool.query(
      `DELETE FROM watchlist
       WHERE watchlistId = ?`,
      [watchlistId]
   );

   res.redirect(`/admin?userSearch=${encodeURIComponent(userSearch)}`);
});

app.post('/admin/deleteUser', requireAdmin, async (req, res) => {
   const { userId } = req.body;

   if (Number(userId) === req.session.user.userId) {
      return res.redirect('/admin');
   }

   await pool.query(
      `DELETE FROM watchlist
       WHERE userId = ?`,
      [userId]
   );

   await pool.query(
      `DELETE FROM users
       WHERE userId = ?`,
      [userId]
   );

   res.redirect('/admin');
});

app.post('/watchlist/add', requireAuth, async (req, res) => {
   const { movieId, title, posterPath, overview, returnSearch } = req.body;

   await pool.query(
      `INSERT IGNORE INTO watchlist 
       (userId, movieId, title, posterPath, overview)
       VALUES (?, ?, ?, ?, ?)`,
      [
         req.session.user.userId,
         movieId,
         title,
         posterPath,
         overview
      ]
   );

   res.redirect(`/search?search=${encodeURIComponent(returnSearch)}&added=true`);
});


app.get('/watchlist', requireAuth, async (req, res) => {
   const [movies] = await pool.query(
      `SELECT watchlistId, movieId, title, posterPath, overview, dateAdded
       FROM watchlist
       WHERE userId = ?
       ORDER BY dateAdded ASC`,
      [req.session.user.userId]
   );

   res.render('watchlist.ejs', { movies });
});

app.post('/watchlist/remove', requireAuth, async (req, res) => {
   const { watchlistId } = req.body;

   await pool.query(
      `DELETE FROM watchlist
       WHERE watchlistId = ? AND userId = ?`,
      [watchlistId, req.session.user.userId]
   );

   res.redirect('/watchlist');
});



//popular movie page
app.get('/popular', async (req, res) => {
   const options = {
      method: 'GET',
      headers: {
         accept: 'application/json',
         Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxZjcyZTdhNTg3OGJhNTYyOGJmMDgzNWNhNGZjMGNmYyIsIm5iZiI6MTc3NDM3MDM4MC4zOCwic3ViIjoiNjljMmJlNGNkOWVlMGEyZGJiN2JjYzMwIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.A6PJgrCtyusFUW9ueoWDMma1nNUU0e_5C-ZDyYg8ye8'
      }
   };

   const response = await fetch('https://api.themoviedb.org/3/trending/movie/day', options);
   const data = await response.json();

   //only first 6
   const topMovies = data.results.slice(0, 6);
   res.render('popular.ejs', { topMovies });
})

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
            movieId: item.id,
            title: item.title || item.name || "Untitled",
            posterPath: item.poster_path,
            overview: item.overview || "No description available."
         });
      });
   }

   let watchlistMovieIds = [];

   if (req.session.user) {
      const [watchlistRows] = await pool.query(
         `SELECT movieId
         FROM watchlist
         WHERE userId = ?`,
         [req.session.user.userId]
      );

      watchlistMovieIds = watchlistRows.map(row => row.movieId);
   }

   const added = req.query.added === "true";

   console.log("Movies sent to search page:", movies);
   res.render("search.ejs", { movies, user_search, watchlistMovieIds, added });

});

//  -- AI STUFF -- 
app.post('/movieModalAi', async (req, res) => {
   const { title, overview, question } = req.body;

   try {
      let prompt;

      if (question && question.trim() !== "") {
         prompt = `
         The user is asking about the movie "${title}".
         Movie overview: ${overview}

         User question: ${question}
         `;
      } else {
         prompt = `
         Write a short summary about the movie and who the target audiance may be, "${title}".
         Here is the movie overview: ${overview}
         `;
      }

      const response = await Ai.models.generateContent({
         model: "gemini-2.5-flash",
         contents: prompt
      });

      res.json({ answer: response.text });
   } catch (err) {
      console.error("Gemini error:", err);
      res.json({ answer: "Sorry, I could not generate a response." });
   }
});

// // -- I plan to use this for the  watchlist button - Carlos
// app.post('/addToWatchlist', requireAuth, async (req, res) => {
//    const userId = req.session.user.userId;
//    const { title, overview, posterPath } = req.body;

//    try {
//       await pool.query(
//          `INSERT INTO watchlist (userId, title, overview, posterPath)
//           VALUES (?, ?, ?, ?)`,
//          [userId, title, overview, posterPath]
//       );

//       res.json({
//          success: true,
//          message: "Movie added to watchlist"
//       });
//    } catch (err) {
//       console.error("Watchlist insert error:", err);

//       res.json({
//          success: false,
//          message: "Could not add movie"
//       });
//    }
// });

app.get('/settings', requireAuth, (req, res) => {
   res.render('settings.ejs');
});

app.listen(3000, () => {
   console.log('server started');
});