const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

app.listen(3000, () => {
  console.log("server is running http://localhost:3000/");
});

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};

initializeDbAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const validPassword = (password) => {
  return password.length > 4;
};

app.post("/register", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  console.log(dbUser);

  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;

    if (validPassword(password)) {
      await db.run(createUserQuery);
      response.send(`User created successfully`);
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// 1.login
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  console.log(dbUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//2.get state
const convertObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

app.get("/states/", authenticateToken, async (request, response) => {
  let requestQuery = `
   SELECT 
   *
   FROM
   state
   `;

  let store = await db.all(requestQuery);
  response.send(store.map((eachState) => convertObject(eachState)));
});

//  3.specific state

const convertObject1 = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  let { stateId } = request.params;

  let requestQuery = `
   SELECT 
   *
   FROM
   state
   WHERE
    state_id = ${stateId};
   `;

  let store = await db.get(requestQuery);
  response.send(convertObject1(store));
});

//4.post districts

app.post("/districts/", authenticateToken, async (request, response) => {
  const { stateId, districtName, cases, cured, active, deaths } = request.body;
  let requestQuery = `
   INSERT INTO
   district(state_id,district_name,cases, cured, active, deaths)
   VALUES( ${stateId}, '${districtName}',${cases},${cured},${active},${deaths})
   `;

  let store = await db.run(requestQuery);
  console.log(store);
  response.send("District Successfully Added");
});

// 5.specific district

const convertObject11 = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    let { districtId } = request.params;

    let requestQuery = `
   SELECT 
   *
   FROM
    district
   WHERE
    district_id = ${districtId};
   `;

    let store = await db.get(requestQuery);
    response.send(convertObject11(store));
  }
);

//6.delete

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    let { districtId } = request.params;

    let requestQuery = `
   DELETE
   FROM
   district
   WHERE
     district_id = ${districtId};
   `;

    await db.run(requestQuery);
    response.send("District Removed");
  }
);

//7.update district

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    let { districtId } = request.params;

    let requestQuery = `
   UPDATE 
   district
   SET
   district_name ='${districtName}',
   state_id =${stateId},
   cases =${cases},
    cured =${cured},
   active =${active},
   deaths   =${deaths};
    WHERE
     district_id = ${districtId};

   `;

    await db.run(requestQuery);
    response.send("District Details Updated");
  }
);

//8.API

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    let { stateId } = request.params;
    console.log(stateId);

    let requestQuery = `
   SELECT 
   sum(cases) as totalCases,
   sum(cured) as  totalCured ,
   sum(active) as totalActive  ,
   sum(deaths) as totalDeaths
   FROM
    district
   WHERE
    state_id = ${stateId}
    ;
   `;
    let store = await db.get(requestQuery);
    console.log(store);
    //const result = convertObjectSingle(store);
    response.send(store);
  }
);
module.exports = app;
