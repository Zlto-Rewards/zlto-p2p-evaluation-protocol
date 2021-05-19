pragma solidity ^0.4.25;

contract ZltoStorage {
    constructor() public {
        owner = msg.sender;
    }
    
    event DocumentAdded(
        bytes32 id,
        bytes32 documentHash
    );

    address public owner;
  
    mapping (bytes32 => bytes32) public hashesById;

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    modifier noHashExistsYet(bytes32 id) {
        require(hashesById[id] == "");
        _;
    }

    function ProofOfExistence() public {
        owner = msg.sender;
    }

    function notarizeHash(bytes32 id, bytes32 documentHash) onlyOwner public returns(bool){
        require(msg.sender == owner);
        hashesById[id] = documentHash;
        emit DocumentAdded(id, documentHash);

        return true;
    }

    function notarizeHashes(bytes32[] idArray, bytes32[] hashArray) onlyOwner public returns(bool) {
        require(msg.sender == owner);
        require(idArray.length == hashArray.length);

        for (uint i=0; i<idArray.length; i++) {
            hashesById[idArray[i]] = hashArray[i];

            emit DocumentAdded(idArray[i], hashArray[i]);
        }
        return true;
    }

    function doesHashExist(bytes32 id, bytes32 documentHash) public view returns (bool) {
        return hashesById[id] == documentHash;
    }
}
