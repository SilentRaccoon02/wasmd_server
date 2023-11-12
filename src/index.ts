import express, { type Application } from 'express';
import path from 'path';

const DIRNAME: string = path.resolve();
const PORT: number = 2512;

const app: Application = express();
app.use(express.static(path.resolve(DIRNAME, '..', 'wasmd_web', 'build')));

app.listen(PORT, () => {
    console.log(`Running on port ${PORT}`);
});
