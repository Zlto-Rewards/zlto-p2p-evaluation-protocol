/* eslint no-console: 0 */
require('dotenv').config();
const _ = require('lodash');
const path = require('path');
const express = require('express'); const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const config = require('./webpack.config.js');
const isDeveloping = process.env.NODE_ENV !== 'production';
const port = isDeveloping ? 3000 : process.env.PORT;
const app = express();
const bodyParser = require('body-parser');
const EthereumTx = require('ethereumjs-tx')

app.use(bodyParser.urlencoded({ extended: false}));
app.use(bodyParser.json());

const asyncMiddleware = fn =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch(next);
  };

const { contractAtAddress, web3 } = require('./eth/util');
// Ropsten address
// const contractAddress = '0x517447acd5621573c07d120a1ec9dab8b4679280';

// Mainnet address
const contractAddress = '0x7d5B6DcCf993B11c0A94Dc915796032E69516587';
let contract;
let nonce = 50;

async function pushToChain(data) {
    const idArray = data.map(d => "0x" + d.id.replace(/-/g, ""));
    const hashArray = data.map(d=> "0x" + d.hash);
    console.log('idArray: ', idArray);
    console.log('hashArray: ', hashArray);

    try {
        const contract = await contractAtAddress(contractAddress);
        console.log('contract: ', contract);
        let count = await web3.eth.getTransactionCount(contractAddress);
        console.log('count: ', count);
        const privateKey = Buffer.from(process.env.METAMASK_KEY, 'hex');
        const txParams = {
            from: '0xe16C85791Eb53E3f96803dfdcA486CbFC2B47D32',
            gasPrice: web3.utils.toHex(100* 1e9),
            gasLimit:web3.utils.toHex(500000),
            gas: 210000,
            to: contractAddress,
            data: contract.methods.notarizeHashes(idArray, hashArray).encodeABI(),
            nonce: web3.utils.toHex(nonce++)
        };
        const tx = new EthereumTx(txParams);
        console.log('tx: ', tx);
        tx.sign(privateKey);
        const serializedTx = tx.serialize();

        const result = await web3.eth.sendSignedTransaction('0x'+serializedTx.toString('hex'));
        console.log('result: ', result)

        return result;
    } catch(e) {
        console.log('error with contract: ', e.message);
    }
}

async function verifyHashById(id) {
    try {
        const contract = await contractAtAddress(contractAddress);
        console.log('contract: ', contract);
        const formattedId = "0x" + id.replace(/-/g, "");
        const result = await contract.methods.hashesById(formattedId).call();

        return result;
    } catch(e) {
        console.log('error with contract: ', e.message);
    }
}

function normalizeRep(data) {
    const { repToBeGained } = data.metadata;
    let weightedDecision = 0;

    //
    // Normalize reputation pool gained by winners
    //
    _.forEach(data.evaluations, eval => {
        const { judgment } = eval;
        let { reputationBefore, reputationDuring } = eval.evaluator;
        reputationBefore = Math.round(reputationBefore);

        let repDiff = reputationDuring - reputationBefore;

        if (repDiff < 0) {
            eval.evaluator.finalReputation = reputationBefore;
        } else {
            const normalizationFactor = repToBeGained / data.reputationProduced;
            console.log('normalizationFactor: ', normalizationFactor);
            const normalizedRepDiff = repDiff * normalizationFactor;
            console.log('normalizedRepDiff: ', normalizedRepDiff);
            eval.evaluator.finalReputation = reputationBefore + normalizedRepDiff;
        }
    });

    //
    // Calculated final decision
    //
    _.forEach(data.evaluations, eval => {
        console.log('eval: ', eval);
        const { reputationBefore, finalReputation } = eval.evaluator;
        console.log('reputationBefore: ', reputationBefore);
        console.log('finalReputation: ', finalReputation);

        const finalRepDiff = finalReputation - reputationBefore;
        // if judgment is false, push it negative. vice versa.
        console.log('eval.judgment: ', eval.judgment);
        const judgmentDirection = eval.judgment === 0 ? -1 : 1; 
        console.log('finalRepDiff: ', finalRepDiff);
        console.log('judgmentDirection: ', judgmentDirection);

        weightedDecision += (finalRepDiff * judgmentDirection)
        console.log('weighted decision: ', weightedDecision)
    });

    const finalJudgment = weightedDecision < 0 ? 0 : 1

    data.metadata.finalJudgment = finalJudgment;

    //
    // Penalize those who disagreed with final judgment
    //
    _.forEach(data.evaluations, eval => {
        const { judgment } = eval;
        const { reputationBefore, reputationDuring } = eval.evaluator;
        let repDiff = reputationDuring - reputationBefore;

        if (judgment != finalJudgment) {
            // if user lost more rep than repToBeGained, set rep lost = repToBeGained
            if (Math.abs(repDiff) > repToBeGained) {
                eval.evaluator.finalReputation = reputationBefore - repToBeGained;
            } else {
                eval.evaluator.finalReputation = reputationDuring;
            }
            eval.evaluator.finalReputationDifference = Math.round(eval.evaluator.finalReputation) - reputationBefore;
        } else {
            let repDiff = Math.round(eval.evaluator.finalReputation) - reputationBefore;
            eval.evaluator.finalReputationDifference = repDiff > 0 ? repDiff : 0;
        }

        // NOTE: finalReputation is not necesarily synced with live system (user may participate in multiple evaluations);
        // client side will use finalReputationDifference to avoid syncing issues
        eval.evaluator.finalReputation = Math.round(eval.evaluator.finalReputation);
    })

    // set these two fields equal for consistency
    data.metadata.reputationProduced = repToBeGained;
    data.metadata.unnormalizedReputationProduced = data.reputationProduced

    return data;
}

// LevelDB to store intermediate states of evaluation cycles
const level = require('level');
var db = level('./mydb');

if (isDeveloping) {
  const compiler = webpack(config);
  const middleware = webpackMiddleware(compiler, {
    publicPath: config.output.publicPath,
    contentBase: 'src',
    stats: {
      colors: true,
      hash: false,
      timings: true,
      chunks: false,
      chunkModules: false,
      modules: false
    }
  });

  app.use(middleware);
  app.use(webpackHotMiddleware(compiler));
} else {
  app.use(express.static(__dirname + '/dist'));
}

// const experiment = require('./experiment/setup');
// app.get('/runExperiment', async function(req, res) {
//   experiment.generateExperiment(20, 30);
// });

app.delete('/cancelRequest', async function(req, res) {
  if(db) {
    let id = req.params.id;
    db.del(id, function (err) {
      if(err) {
        res.status(500).send({ error: 'error in deleting the request' });
      }
    });
    res.json({'message': 'success'});
  } else {
    res.status(500).send({ error: 'no db instance' });
  }
});

app.post('/pushToChain', async function(req, res) {
    console.log('req.body: ', req.body);
    const ethResult = await pushToChain(req.body);
    console.log('ethResult: ', ethResult);
    if(ethResult) {
        res.json({'message': 'pushed data to ethereum contract successfully', 'blockchainHash': ethResult.transactionHash});
    } else {
        res.status(500).send({ error: 'error in eth contract result' });
    }
});

app.get('/verifyChain', async function(req, res) {
    const id = req.params.id;
    if(!id) res.status(500).send({ error: 'id parameter required' });

    const result = await verifyHashById(id);

    if(result) {
        res.json({'message': 'hash for id retrieved successfully', 'hash': result});
    } else {
        res.json({'message': 'error in eth contract result'});
    }
});

app.post('/newRequest', async function(req, res) {
  let newReqObj = {
    id: req.body.id,
    requesterId: req.body.requesterId,
    metadata: req.body.metadata,
    evaluations: []
  };
  if(db) {
    await db.put(req.body.id, JSON.stringify(newReqObj));
    res.json({'message': 'success', 'storedRequest': newReqObj});
  } else {
    res.status(500).send({ error: 'no db instance' });
  }
});

app.get('/checkRequest', async function(req, res) {
  if(db) {
    try {
      let storedRequest = await db.get(req.params.id, { asBuffer: false });
      if(storedRequest) {
        res.setHeader('Content-Type', 'application/json');
        res.send({'message': 'success', 'storedRequest': JSON.parse(storedRequest)});
      }
    } catch (e) {
      res.send(e);
    }
  } else {
    res.status(500).send({ error: 'no db instance' });
  }
});

app.post('/newEvaluation', async function(req, res) {
  const requestId = req.body.id;

  if(db) {
    try {
      let query = await db.get(requestId, { asBuffer: false });
      if(query) {
        storedRequest = JSON.parse(query);
        const storedEvals = storedRequest.evaluations;
        const evaluatorExists = _.find(storedEvals, eval => eval.evaluator.id === req.body.evaluator.id);
        const { judgment, evaluator } = req.body

        if(!_.isUndefined(evaluatorExists)) { // this evaluator has already evaluated
          evaluatorExists.judgment = judgment;
        } else {
          const newEvaluation = {
            //TODO: add timestamp
            evaluator,
            judgment
          };
          // ============  Step 1) Cost Function: calculate stake for the new evaluator ============
          // Vk
          let repGained = storedEvals.length > 0 
            ? storedEvals
              .map(eval => (eval.evaluator.reputationDuring - eval.evaluator.reputationBefore))
              .reduce((a,b) => a + b, 0)
            : 0;

          console.log('repGained: ', repGained);
          repGained = repGained < 0 ? 0 : repGained;

          const { repToBeGained } = storedRequest.metadata; // R
          const STAKE_FRACTION = 0.10; // s (negative slope of rep flow curve)
          const { reputationBefore } = newEvaluation.evaluator;
          const stake = (1-repGained/repToBeGained) * (reputationBefore * STAKE_FRACTION);

          // never let stake exceed how much rep they have (leads to negative  reputationDuring)
          newEvaluation.evaluator.stake = stake > reputationBefore ? reputationBefore : stake;
          newEvaluation.evaluator.reputationDuring = reputationBefore - newEvaluation.evaluator.stake;

          const repDiff = newEvaluation.evaluator.reputationDuring - newEvaluation.evaluator.reputationBefore;
          storedRequest.reputationProduced = repDiff > 0 ? repDiff : 0; 

          // ============ Step 2) Rep flow: recalculate rep for committed evaluators ============
          const STAKE_DIST_FRACTION = 0.6; // positive slope of rep flow curve

          if (storedEvals.length > 0) {
              // Wk
              const reputationInAgreement = storedEvals
                .filter(eval => eval.judgment === judgment)
                .map(eval => eval.evaluator.reputationDuring)
                .reduce((a,b) => a + b, 0);
              console.log('reputationInAgreement: ', reputationInAgreement);

              storedEvals.forEach(eval => {
              const agreesWithCurrent = eval.judgment === newEvaluation.judgment;
              if(agreesWithCurrent) {
                const repayment = STAKE_DIST_FRACTION * eval.evaluator.reputationDuring * newEvaluation.evaluator.reputationDuring / reputationInAgreement;
                console.log('repayment: ', repayment);
                eval.evaluator.reputationDuring += repayment;
              }
              // Track progress
              const repDiff = eval.evaluator.reputationDuring - eval.evaluator.reputationBefore;
              storedRequest.reputationProduced += repDiff > 0 ? repDiff : 0;
            });
          }
          // ============ Step 3) Store updated evals ============ 
          storedEvals.push(newEvaluation);
          storedRequest.evaluations = storedEvals;
        }

        try {
          await db.put(requestId, JSON.stringify(storedRequest));
          // Enough evaluations have come through OR enough reputation has come through:
          // if(storedRequest.evaluations.length == NUM_EVALUATORS_REQUIRED) {
          console.log('reputationProduced: ', storedRequest.reputationProduced);

          if(storedRequest.reputationProduced >= storedRequest.metadata.repToBeGained) {
            storedRequest = normalizeRep(storedRequest);

            db.del(requestId, function(err) {
              if (err) console.log('error in deleting the completed evaluation');
            });

            res.json({'message': 'success', 'details': 'evaluation cycle completed, workAsset finalized', 'workAsset': storedRequest});
          } else {
            // TODO: Django server will deduct the stake from the evaluator's live reputation
            res.send({'message': 'success', storedRequest});
          }
        } catch(e) {
          res.status(500).send({ error: 'error in storing request with updated evaluator', msg: e.message });
        }
      } else {
        res.status(500).send({ error: 'error in obtaining request with specified id' });
      }
    } catch(e) {
      console.log('e: ', e);
      res.status(500).send({ error: 'error in obtaining request with specified id' });
    }
  } else {
    res.status(500).send({ error: 'no db instance' });
  }
});

app.listen(port, '0.0.0.0', function onStart(err) {
  if (err) {
    console.log('error on app.listen: ', err);
  }
  console.info('==> 🌎 Listening on port %s. Open up http://0.0.0.0:%s/ in your browser.', port, port);
});
