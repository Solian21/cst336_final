import express from 'express';
const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));

app.get('/',  async (req, res) => {
   const options = {
      method: 'GET',
      headers: {
         accept: 'application/json',
         Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxZjcyZTdhNTg3OGJhNTYyOGJmMDgzNWNhNGZjMGNmYyIsIm5iZiI6MTc3NDM3MDM4MC4zOCwic3ViIjoiNjljMmJlNGNkOWVlMGEyZGJiN2JjYzMwIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.A6PJgrCtyusFUW9ueoWDMma1nNUU0e_5C-ZDyYg8ye8'
      }
   };

   const response = await fetch('https://api.themoviedb.org/3/discover/movie',options);
   const data = await response.json();
   const movies = data.results;
   const randomMovie = movies[Math.floor(Math.random() * movies.length)];

   res.render("home.ejs", {movie: randomMovie});
});

// Sign in Page
app.get('/signin', (req, res) => {
   res.render('signin.ejs')
});

//popular movie page
app.get('/popular', async (req,res)=>{
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
   const topMovies = data.results.slice(0,6);
   res.render('popular.ejs', {topMovies});
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

   //   ----API SEARCH STUFF -----
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