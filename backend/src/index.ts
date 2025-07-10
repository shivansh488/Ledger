import dotenv from "dotenv";
import express from "express";
import {
  fetchAttendanceDetails,
  loginSimple
} from "./controllers/controller";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post("/login", loginSimple);
app.get("/getAttendanceDetails", fetchAttendanceDetails);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
