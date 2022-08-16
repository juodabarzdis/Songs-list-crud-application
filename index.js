// Projekte naudojami moduliai: express, MySQL2, nodemon, express-handlebars
import express from "express";
import { engine } from "express-handlebars";
import mysql from "mysql2/promise";
import multer from "multer";
import session from "express-session";

const port = process.env.PORT || 3000;

const app = express();
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
  })
);

const auth = (req, res, next) => {
  if (!req.session.loggedIn) return res.redirect("/");

  next();
};

app.engine("handlebars", engine());
app.set("view engine", "handlebars");
app.set("views", "./views");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("views"));

const database = await mysql.createConnection({
  host: "pauliuspetrunin.lt",
  user: "bit",
  password: "kulokas",
  database: "Lukas",
});

//RENDER

app.get("/", async (req, res) => {
  const message = req.query.message;
  const songs = await database.query(
    "SELECT id, artist_name, song_Name, song_Album FROM songs"
  );

  const playlists = await database.query(
    "SELECT id, playlist_name, image FROM playlists"
  );

  res.render("indexUnauth", {
    songs: songs[0],
    playlists: playlists[0],
    message,
  });
});

//DELETE

app.get("/delete/:id", auth, async (req, res) => {
  const id = req.params.id;
  await database.query(`DELETE FROM songs WHERE id = ${id}`);
  res.redirect("/songs");
});

//CREATE

// app.post("/", async (req, res) => {
//   const { artist_name, song_Name, song_Album } = req.body;
//   try {
//     await database.query(
//       "INSERT INTO songs (artist_name, song_Name, song_Album) VALUES (?, ?, ?)",
//       [artist_name, song_Name, song_Album]
//     );
//     res.redirect("/");
//   } catch (error) {
//     return res.redirect("/?message=tokia reikmse yra");
//   }
// });

//UPDATE

app.get("/edit/:id", auth, async (req, res) => {
  const id = req.params.id;
  const song = await database.query(
    `SELECT id, artist_name, song_Name, song_Album FROM songs WHERE id = ${id}`
  );
  const zong = song[0][0];

  res.render("edit", zong);
});

app.post("/edit/:id", async (req, res) => {
  const id = req.params.id;
  const { song_Name, song_Album } = req.body;
  await database.query(
    "UPDATE songs SET song_Name = ?, song_Album = ? WHERE id = ?",
    [song_Name, song_Album, id]
  );
  res.redirect("/");
});

//ADD PLAYLIST

app.use("/views", express.static("views"));

// konfiguruojam upload funkcija

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "views/images/");
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split(".");
    const uniqueSuffix =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      "." +
      ext[ext.length - 1];
    cb(null, uniqueSuffix);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, next) {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/gif"
    ) {
      next(null, true);
    } else {
      next(null, false);
    }
  },
});

app.get("/playlists", auth, async (req, res) => {
  if (!req.session.loggedIn) {
    res.redirect("/");
  }
  const user = req.session.user;
  const playlists = await database.query(
    "SELECT id, playlist_name, image FROM playlists WHERE user_id = ?",
    [user]
  );
  res.render("playlists", { playlists: playlists[0] });
});

app.post("/playlists", upload.single("image"), async (req, res) => {
  const { playlist_name } = req.body;
  const user = req.session.user;
  const image = req.file ? req.file.filename : "";
  await database.query(
    "INSERT INTO playlists (playlist_name, image, user_id) VALUES (?, ?, ?)",
    [playlist_name, image, user]
  );
  res.redirect("/playlists");
});

app.get("/delete/playlists/:id", auth, async (req, res) => {
  const id = req.params.id;
  await database.query(`DELETE FROM playlists WHERE id = ${id}`);
  res.redirect("/playlists");
});

// EDIT PLAYLIST

app.get("/editPlaylist/:id", auth, async (req, res) => {
  const id = req.params.id;
  const playlist = await database.query(
    `SELECT id, playlist_name, image FROM playlists WHERE id = ${id}`
  );
  const playlistObj = playlist[0][0];
  res.render("editPlaylist", playlistObj);
});

app.post(
  "/editPlaylist/:id",
  auth,
  upload.single("image"),
  async (req, res) => {
    const id = req.params.id;
    const { playlist_name } = req.body;
    const image = req.file ? req.file.filename : "";
    await database.query(
      "UPDATE playlists SET playlist_name = ?, image = ? WHERE id = ?",
      [playlist_name, image, id]
    );

    res.redirect("/playlists");
  }
);
// REGISTER

app.get("/register", (req, res) => {
  const message = req.query.message;
  res.render("register", message);
});

app.post("/register", async (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  try {
    await database.query(
      "INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)",
      [first_name, last_name, email, password]
    );
    res.redirect("/", { message: "Sveiki prisiregistravę" });
  } catch (error) {
    return res.redirect("/?message=Sveiki prisiregistravę");
  }
});

// LOGIN

app.get("/login", async (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const login = await database.query(
      `SELECT * FROM users WHERE email = '${email}' AND password='${password}'`
    );
    if (login[0].length !== 0) {
      req.session.user = login[0][0].id;
      req.session.loggedIn = true;
      return res.redirect("/?message=Sveiki prisijungę");
    } else
      return res.redirect("/?message=Neteisingas slaptažodis arba el.pastas");
  } catch (error) {
    return res.redirect("/?message=Neteisingas slaptažodis arba el.pastas");
  }
});

app.get("/index", auth, async (req, res) => {
  const message = req.query.message;
  const songs = await database.query(
    "SELECT id, artist_name, song_Name, song_Album FROM songs"
  );

  const playlists = await database.query(
    "SELECT id, playlist_name, image FROM playlists"
  );

  res.render("index", {
    songs: songs[0],
    playlists: playlists[0],
    message,
  });
}),
  // SONGS
  app.get("/songs", auth, async (req, res) => {
    const songs = await database.query(
      "SELECT id, artist_name, song_Name, song_Album FROM songs"
    );

    const playlists = await database.query(
      "SELECT id, playlist_name FROM playlists WHERE user_id = ?",
      [req.session.user]
    );
    console.log(playlists[0]);
    res.render("songs", { songs: songs[0], playlists: playlists[0] });
  });

app.post("/songs", auth, async (req, res) => {
  const { user_id, artist_name, song_Name, song_Album } = req.body;
  console.log(req.body);
  try {
    await database.query(
      "INSERT INTO songs (playlist_id, artist_name, song_Name, song_Album) VALUES (?, ?, ?, ?)",
      [user_id, artist_name, song_Name, song_Album]
    );
    res.redirect("/songs");
  } catch (error) {
    return res.redirect("/songs/?message=tokia reikmse yra");
  }
}),
  app.listen(port);
