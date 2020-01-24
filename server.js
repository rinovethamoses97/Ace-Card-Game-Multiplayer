let express=require("express");
let Room=require("./room.js");
let User=require("./user.js");
let app=express();
app.use(express.static("./public"));
let rooms=[];
app.get("/",(req,res)=>{
    res.sendFile("index.html");
})
let server=app.listen(process.env.PORT||3000,()=>{
    console.log("Server Running");
})
let io=require("socket.io")(server);
io.on("connection",(socket)=>{
    console.log("A Client is connected");
    socket.on("createRoom",(req)=>{
       if(checkRoomAvailability(req.roomName)){
            let room=new Room(req.roomName);
            let user=new User(socket.id,req.userName);
            room.users.push(user);
            rooms.push(room);
            socket.join(req.roomName);
            socket.emit("roomCreated");
            io.sockets.in(req.roomName).emit("userJoined",room.users);
       }
       else{
           socket.emit("noRoom");
       }
    });
    socket.on("joinRoom",(req)=>{
        for(let i in rooms){
            if(rooms[i].name===req.roomName){
                let user=new User(socket.id,req.userName);
                rooms[i].users.push(user);
                socket.join(req.roomName);
                socket.emit("roomJoined");
                io.sockets.in(req.roomName).emit("userJoined",rooms[i].users);
                return;
            }
        }
        socket.emit("noRoom");
    });
});
function checkRoomAvailability(name){
    for(let i in rooms){
        if(rooms[i].name===name){
            return false;
        }
    }
    return true;
}
