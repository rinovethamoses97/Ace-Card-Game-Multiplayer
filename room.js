class Room{
    constructor(name_){
        this.name=name_;
        this.users=[];
        this.lock=false;
    }
} 
module.exports=Room;