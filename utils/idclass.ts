import { config } from "dotenv";
config();

const isTest = process.env.isTest === "true";

class IDClass {

  ownershipID() {
    return "771514771295436851";
  }

  

  channelErrorLogs() {
    return "1421556360029405274";
  }

 
  
  
}


// role/channelNAME() {
//  return isTest ? "TEST_ROLE/CHANNEL_ID" : "MAIN_ROLE_CHANNEL_ID";
//}

const idclass = new IDClass();
export default idclass;
