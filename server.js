let express=require("express");
let Room=require("./room.js");
let User=require("./user.js")
let axios=require("axios");
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
            if(rooms[i].name===req.roomName && !rooms[i].lock){
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
    socket.on("disconnect",()=>{
        for(let i in rooms){
            for(let j in rooms[i].users){
                if(rooms[i].users[j].id===socket.id){
                    // remove the user from the room;
                    rooms[i].users[j].connected=false;
                    io.sockets.in(rooms[i].name).emit("userJoined",rooms[i].users);
                }
            }
        }
    });
    socket.on("msgSend",(req)=>{
        for(let i in rooms){
            if(rooms[i].name===req.roomName){
                rooms[i].msg.push({user:req.user,msg:req.msg});
                io.sockets.in(rooms[i].name).emit("newMsg",rooms[i].msg);
                return;
            }
        }
    })
    socket.on("startGame",(roomName)=>{
        let room=lockRoom(roomName);
        let noOfUsers=room.users.length;
        let noOfCardsForPlayer=Math.floor(52/noOfUsers);
        // let noOfCardsForPlayer=3;//for development purpose
        axios.get("https://deckofcardsapi.com/api/deck/new/draw/?count="+(noOfCardsForPlayer*noOfUsers)).then((res)=>{
            let index=0;
            let AS=false;
            for(let i in room.users){
                for(let j=0;j<noOfCardsForPlayer;j++){
                    room.users[i].cards.push(res.data.cards[index]);
                    index++;
                }
                io.to(room.users[i].id).emit("init",room.users[i]);        
                for(let j in room.users[i].cards){
                    if(room.users[i].cards[j].code==="AS"){
                        AS=true;
                        room.users[i].currentChance=true;
                        room.currentChance=parseInt(i);
                    }
                }
                
            };
            if(!AS){
                room.users[0].currentChance=true;
                room.currentChance=0;
            }
            io.to(room.name).emit("tableLoad",room);
        }).catch((err)=>{
            console.log(err);
        })
    });
    socket.on("putOnTable",(req)=>{
        console.log(req);
        for(let i in rooms){
            if(rooms[i].name===req.roomName){
                for(let j in rooms[i].users){
                    if(rooms[i].users[j].id===socket.id){
                        if(!rooms[i].users[j].currentChance){
                            socket.emit("notYourChance");
                            return;
                        }
                        rooms[i].index++;
                        for(let x in rooms[i].users[j].cards){
                            if(rooms[i].users[j].cards[x].code===req.card){
                                
                                if(req.cut){
                                    rooms[i].users[j].currentCard=rooms[i].users[j].cards[x];
                                    rooms[i].users[j].currentChance=false;
                                    rooms[i].users[j].cards.splice(x,1);
                                    io.to(rooms[i].name).emit("tableLoad",rooms[i]);
                                    io.to(rooms[i].users[j].id).emit("init",rooms[i].users[j]); 
                                    
                                    setTimeout(cut,2000,rooms[i],rooms[i].users[j].currentCard,rooms[i].users[j]);
                                    return;
                                }
                                else{
                                    rooms[i].users[j].currentCard=rooms[i].users[j].cards[x];
                                    rooms[i].users[j].currentChance=false;
                                    rooms[i].users[j].cards.splice(x,1);
                                }  
                                
                                
                                if(rooms[i].index===rooms[i].users.length){
                                    // clear the table
                                    io.to(rooms[i].name).emit("tableLoad",rooms[i]);
                                    io.to(rooms[i].users[j].id).emit("init",rooms[i].users[j]);
                                    for(let z=rooms[i].users.length-1;z>=0;z--){
                                        if(rooms[i].users[z].cards.length==0){
                                            rooms[i].winUsers.push(rooms[i].users[z]);
                                            rooms[i].users.splice(z,1);
                                        }
                                    }            
                                    io.in(rooms[i].name).emit("winStatus",rooms[i].winUsers);           
                                    setTimeout(clearTable,2000,rooms[i]);
                                    return;
                                }
                                else{
                                    rooms[i].currentChance=(rooms[i].currentChance+1)%rooms[i].users.length;
                                    rooms[i].users[rooms[i].currentChance].currentChance=true;
                                    io.to(rooms[i].name).emit("tableLoad",rooms[i]);
                                    io.to(rooms[i].users[j].id).emit("init",rooms[i].users[j]);
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
    });
});
function cut(room,card,user){
    room.index=0;
    user.currentCard=null;
    for(let i in room.users){
        if(room.users[i].currentCard!=null && room.users[i].currentCard.code[0]==="A"){
            room.currentChance=parseInt(i);
            room.users[i].currentChance=true;
            for(let j in room.users){
                if(room.users[j].currentCard!=null){
                    room.users[i].cards.push(room.users[j].currentCard);
                    room.users[i].currentCard=null;
                }
            }
            room.users[i].cards.push(card);
            for(let z=room.users.length-1;z>=0;z--){
                if(room.users[z].cards.length==0){
                    room.winUsers.push(room.users[z]);
                    room.users.splice(z,1);
                }
            }
            io.in(room.name).emit("winStatus",room.winUsers);
            io.to(room.name).emit("tableLoad",room);
            io.to(room.users[i].id).emit("init",room.users[i]);
            return;
        }
    }
    for(let i in room.users){
        if( room.users[i].currentCard!=null && room.users[i].currentCard.code[0]==="K"){
            room.currentChance=parseInt(i);
            room.users[i].currentChance=true;
            for(let j in room.users){
                if(room.users[j].currentCard!=null){
                    room.users[i].cards.push(room.users[j].currentCard);
                    room.users[i].currentCard=null;
                }
            }
            room.users[i].cards.push(card);
            for(let z=room.users.length-1;z>=0;z--){
                if(room.users[z].cards.length==0){
                    room.winUsers.push(room.users[z]);
                    room.users.splice(z,1);
                }
            }
            io.in(room.name).emit("winStatus",room.winUsers);
            io.to(room.name).emit("tableLoad",room);
            io.to(room.users[i].id).emit("init",room.users[i]);
            return;
        }
    }
    for(let i in room.users){
        if(room.users[i].currentCard!=null && room.users[i].currentCard.code[0]==="Q"){
            room.currentChance=parseInt(i);
            room.users[i].currentChance=true;
            for(let j in room.users){
                if(room.users[j].currentCard!=null){
                    room.users[i].cards.push(room.users[j].currentCard);
                    room.users[i].currentCard=null;
                }
            }
            room.users[i].cards.push(card);
            for(let z=room.users.length-1;z>=0;z--){
                if(room.users[z].cards.length==0){
                    room.winUsers.push(room.users[z]);
                    room.users.splice(z,1);
                }
            }
            io.in(room.name).emit("winStatus",room.winUsers);
            io.to(room.name).emit("tableLoad",room);
            io.to(room.users[i].id).emit("init",room.users[i]);
            return;
        }
    }
    for(let i in room.users){
        if(room.users[i].currentCard!=null && room.users[i].currentCard.code[0]==="J"){
            room.currentChance=parseInt(i);
            room.users[i].currentChance=true;
            for(let j in room.users){
                if(room.users[j].currentCard!=null){
                    room.users[i].cards.push(room.users[j].currentCard);
                    room.users[i].currentCard=null;
                }
            }
            room.users[i].cards.push(card);
            for(let z=room.users.length-1;z>=0;z--){
                if(room.users[z].cards.length==0){
                    room.winUsers.push(room.users[z]);
                    room.users.splice(z,1);
                }
            }
            io.in(room.name).emit("winStatus",room.winUsers);
            io.to(room.name).emit("tableLoad",room);
            io.to(room.users[i].id).emit("init",room.users[i]);
            return;
        }
    }
    for(let i in room.users){
        if(room.users[i].currentCard!=null && room.users[i].currentCard.code[0]==="0"){
            room.currentChance=parseInt(i);
            room.users[i].currentChance=true;
            for(let j in room.users){
                if(room.users[j].currentCard!=null){
                    room.users[i].cards.push(room.users[j].currentCard);
                    room.users[i].currentCard=null;
                }
            }
            room.users[i].cards.push(card);
            for(let z=room.users.length-1;z>=0;z--){
                if(room.users[z].cards.length==0){
                    room.winUsers.push(room.users[z]);
                    room.users.splice(z,1);
                }
            }
            io.in(room.name).emit("winStatus",room.winUsers);
            io.to(room.name).emit("tableLoad",room);
            io.to(room.users[i].id).emit("init",room.users[i]);
            return;
        }
    }
    let max=1;
    let us;
    let usIndex=-1;
    for(let i in room.users){
        if(room.users[i].currentCard!=null && parseInt(room.users[i].currentCard.code[0])>max){
            us=room.users[i];
            usIndex=i;
            max=parseInt(room.users[i].currentCard.code[0]);
        }
    }
    room.currentChance=parseInt(usIndex);
    us.currentChance=true;
    for(let j in room.users){
        if(room.users[j].currentCard!=null){
            us.cards.push(room.users[j].currentCard);
            room.users[j].currentCard=null;
        }
    }
    us.cards.push(card);
    for(let z=room.users.length-1;z>=0;z--){
        if(room.users[z].cards.length==0){
            room.winUsers.push(room.users[z]);
            room.users.splice(z,1);
        }
    }
    io.in(room.name).emit("winStatus",room.winUsers);
    io.to(room.name).emit("tableLoad",room);
    io.to(us.id).emit("init",us);
    return;
}
function clearTable(room){
    room.index=0;
    if(room.users.length==0){
        io.to(room.name).emit("tableLoad",room);
        return;
    }
    for(let i in room.users){
        if(room.users[i].currentCard.code[0]==="A"){
            room.currentChance=parseInt(i);
            room.users[i].currentChance=true;
            for(let j in room.users)
                room.users[j].currentCard=null;
            io.to(room.name).emit("tableLoad",room);           
            return;
        }
    }
    for(let i in room.users){
        if(room.users[i].currentCard.code[0]==="K"){
            room.currentChance=parseInt(i);
            room.users[i].currentChance=true;
            for(let j in room.users)
                room.users[j].currentCard=null;
            io.to(room.name).emit("tableLoad",room);
            return;
        }
    }
    for(let i in room.users){
        if(room.users[i].currentCard.code[0]==="Q"){
            room.currentChance=parseInt(i);
            room.users[i].currentChance=true;
            for(let j in room.users)
                room.users[j].currentCard=null;
            io.to(room.name).emit("tableLoad",room);
            return;
        }
    }
    for(let i in room.users){
        if(room.users[i].currentCard.code[0]==="J"){
            room.currentChance=parseInt(i);
            room.users[i].currentChance=true;
            for(let j in room.users)
                room.users[j].currentCard=null;
            io.to(room.name).emit("tableLoad",room);
            return;
        }
    }
    for(let i in room.users){
        if(room.users[i].currentCard.code[0]==="0"){
            room.currentChance=parseInt(i);
            room.users[i].currentChance=true;
            for(let j in room.users)
                room.users[j].currentCard=null;
            io.to(room.name).emit("tableLoad",room);
            return;
        }
    }
    let max=1;
    let us;
    let usIndex=-1;
    for(let i in room.users){
        if(parseInt(room.users[i].currentCard.code[0])>max){
            us=room.users[i];
            usIndex=i;
            max=parseInt(room.users[i].currentCard.code[0]);
        }
    }
    // console.log("Check",us);
    room.currentChance=parseInt(usIndex);
    us.currentChance=true;
    for(let j in room.users)
        room.users[j].currentCard=null;
    io.to(room.name).emit("tableLoad",room);
    return;

}
function lockRoom(roomName){
    for(let i in rooms){
        if(rooms[i].name===roomName){
            rooms[i].lock=true;
            return rooms[i];
        }
    }
}
function checkRoomAvailability(name){
    for(let i in rooms){
        if(rooms[i].name===name){
            return false;
        }
    }
    return true;
}
