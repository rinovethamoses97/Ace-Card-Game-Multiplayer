class Room{
    constructor(name_){
        this.name=name_;
        this.users=[];
        this.lock=false;
        this.currentChance=0;
        this.index=0;
    }
} 
module.exports=Room;