/**
 * A Link between Inputs/Outputs
 * @typedef {Object} LLink
 * @property {number} id - The Links ID
 * @property {string} type - The Link's Type (based on the origin of the link)
 * @property {number} origin_id - The ID of the Origin Node (Output)
 * @property {number} origin_slot - The Slot Number on the Origin Node that the Link is connected to
 * @property {number} target_id - The ID of the Target Node (Input)
 * @property {number} target_slot - The Slot Number on the Origin Node that the Link is connected to
 */

/**
 * Info about a specific Input Slot
 * @typedef {Object} InputInfo
 * @property {Number|null} link - The Link ID that is connected to the Input (if any)
 * @property {String} name - The Name of the Input Slot
 * @property {String|0} type - The Data Type that the Input Slot accepts; 0 corresponds to any
 */

/**
 * Info about a specific Input Slot
 * @typedef {Object} OutputInfo
 * @property {Number[]} links - The Link ID's that is connected to the Output (if any)
 * @property {String} name - The Name of the Output Slot
 * @property {Number} slot_index - The Slot Number of the Output Slot
 * @property {String|0} type - The Data Type that the Output Slot outputs: 0 corresponds to any
 */

/**
 * A base class which provides functionality to generate additional Inputs/Outputs (I/O) when
 * previously defined I/O are connected to.
 * @extends LGraphNode
 * 
 */
class VariadicNode extends LGraphNode{
    /** 
     * The join characters are used by VariadicNode.generateName to
     * generate I/O names
     * @type {string} - the join characters
     * */
    join = "- ";

    /**
     * Creats a new Variadic Node
     * @param {String} o - The LGraphNode's title
     */
    constructor(o){
        super(o);
        this.vars = {};
    }

    /**
     * Returns a name in the form {varname}{this.join}{number} to assign
     * to a newly created I/O or to get a reference for an existing I/O
     * @param {String} varname - The I/O's name
     * @param {Number} number - The count/index-number of I/O with varname
     * @returns {String} - The generated name
     */
    generateName(varname, number){
        return varname + this.join + number;
    }

    /**
     * Creates a new dynamically created Input. Functions like
     * LGraphNode.addInput, but also registers the Input with this
     * node so that new Inputs can be created from it.
     * @param {String} name - The base name of the Input
     * @param {String} type - Valid Slot Type
     * @param  {...any} args - Additional arguments passed to this.addInput
     */
    addVarInput(name, type, ...args){
        if(this.vars[name] === undefined){
            this.vars[name] = {
                name,
                type,
                count: 0
            };
        }
        this.addInput(this.generateName(name, this.vars[name].count), type, ...args);
        this.vars[name].count+=1;
    }

    /**
     * Creates a new dynamically created Output. Functions like
     * LGraphNode.addOutput, but also registers the Output with this
     * node so that new Outputs can be created from it.
     * @param {String} name - The base name of the Output
     * @param {String} type - Valid Slot Type
     * @param  {...any} args - Additional arguments passed to this.addOutput
     */
    addVarOutput(name, type, ...args){
        if(this.vars[name] === undefined){
            this.vars[name] = {
                name,
                type,
                count: 0,};
        }
        this.addOutput(this.generateName(name, this.vars[name].count), type, ...args);
        this.vars[name].count+=1;
    }

    /**
     * Creates a copy of this Node with no connections and its initial I/O's.
     * @returns {LGraphNode} a copy of this Node
     */
    clone(){
        let n = super.clone();
        let remove = [];
        for(let [varname,{count}] of Object.entries(n.vars)){
            if(count ==1) continue;
            for(let i = count; i > 1; i--){
                remove.push(this.generateName(varname, count));
            }
            n.vars[varname].count = 1;
        }
        for(let i=this.inputs.length-1; i > 0; i--){
            if(remove.indexOf(this.inputs[i].name) >= 0){
                this.inputs.splice(i,1);
            }
        }
        for(let i =this.outputs.length -1; i > 0; i--){
            if(remove.indexOf(this.outputs[i].name >= 0)){
                this.outputs.splice(i,1);
            }
        }
        if(remove.length){
            n.setSize(n.computeSize());
        }
        return n;
    }
    
    /**
     * The onConnectionsChange callback which is triggered whenever a link is created or removed
     * from the LGraphNode. When a VarInput/VarOutput is connected to this callback will create
     * a new VarInput/VarOutput of the same kind (VarOutputs are only created on their first connection).
     * When a VarInput/VarOutput loses a connection it is removed and the I/O names are corrected for
     * consistency (VarOutputs are only removed when all connections are removed from them).
     * @param {LiteGraph.INPUT|LiteGraph.OUTPUT} type 
     * @param {Number} slot - The slot number of the I/O
     * @param {Boolean} connected - Whether the link is being added (true) or removed (false)
     * @param {LLink} link_info - Info about the link being added
     * @param {InputInfo|OutputInfo} input_info - Information about the Input or Output Slot which is being connected to or removed from
     * @returns 
     */
    onConnectionsChange(type, slot, connected, link_info, input_info){
        let parts = input_info.name.split(this.join);
        if(parts.length < 2) return;
        let varname = parts.slice(0,parts.length-1).join(this.join);
        if(this.vars[varname] === undefined) return;
        let index = parseInt(parts[parts.length-1]);
        if(isNaN(index)) throw new Error(`Parsed invalid index: ${input_info.name} => ${varname}${this.join} ->${parts}<- Not a Number`);
        if(connected){
            if(type == LiteGraph.INPUT){
                this.addInput(this.generateName(varname,this.vars[varname].count), this.vars[varname].type)
            }else{
                // Outputs can have multiple links, so we need to check if this is the first one
                if(input_info.links.indexOf(link_info.id) > 0) return;
                this.addOutput(this.generateName(varname, this.vars[varname].count), this.vars[varname].type);
            }
            this.vars[varname].count+=1;
        }else{
            if(this.vars[varname].count == 1) return;
            if(type == LiteGraph.INPUT){
                this.removeInput(slot);
                for(let i = index; i < this.vars[varname].count-1; i++){
                    let nextname = this.generateName(varname, i+1);
                    let nextinput = this.findInputSlot(nextname, true);
                    nextinput.name = this.generateName(varname, i);
                }
            }
            else{
                // Outputs can have multiple links, so check if there are any links left before removing
                if(input_info.links.length) return;
                this.removeOutput(slot);
                for(let i = index; i < this.vars[varname].count-1; i++){
                    let nextname = this.generateName(varname, i+1);
                    let nextoutput = this.findOutputSlot(nextname, true);
                    nextoutput.name = this.generateName(varname, i);
                }
            }
            this.vars[varname].count -= 1;
        }
    }
}