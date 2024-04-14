
export default function sleep(sec = 1) {
    return new Promise(resolve => setTimeout(resolve, sec));
}