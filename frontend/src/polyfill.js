// Полифилл для Node.js-объектов в браузере
import { Buffer } from 'buffer';
import process from 'process/browser';

window.Buffer  = Buffer;
window.process = process;
