// These globals are added by Truffle:
/* globals Colony, EternalStorage, RootColony */
import { solSha3 } from 'colony-utils';
import testHelper from '../helpers/test-helper';

contract('Colony', function (accounts) {
  let COLONY_KEY;
  const MAIN_ACCOUNT = accounts[0];
  const OTHER_ACCOUNT = accounts[1];
  const GAS_PRICE = 20e9;
  // this value must be high enough to certify that the failure was not due to the amount of gas but due to a exception being thrown
  const GAS_TO_SPEND = 4700000;

  const optionsToSpotTransactionFailure = {
    from: MAIN_ACCOUNT,
    gasPrice: GAS_PRICE,
    gas: GAS_TO_SPEND,
  };

  let colony;
  let eternalStorage;
  let rootColony;
  let eternalStorageRoot;

  before(function (done) {
    rootColony = RootColony.deployed();
    eternalStorageRoot = EternalStorage.deployed();
    done();
  });

  beforeEach(function (done) {
    COLONY_KEY = testHelper.getRandomString(7);

    eternalStorageRoot.owner.call()
    .then(function () {
      return rootColony.createColony(COLONY_KEY, { from: MAIN_ACCOUNT });
    })
    .then(function () {
      return rootColony.getColony.call(COLONY_KEY);
    })
    .then(function (colony_) {
      colony = Colony.at(colony_);
      return;
    })
    .then(function () {
      return colony.eternalStorage.call();
    })
    .then(function (extStorageAddress) {
      eternalStorage = EternalStorage.at(extStorageAddress);
    })
    .then(done)
    .catch(done);
  });

  describe('when created', function () {
    it('should take deploying user as an admin', function (done) {
      colony.isUserAdmin.call(MAIN_ACCOUNT)
      .then(function (admin) {
        assert.equal(admin, true, 'First user isn\'t an admin');
      })
      .then(done)
      .catch(done);
    });

    it('should other users not be an admin until I add s/he', function (done) {
      colony.isUserAdmin.call(OTHER_ACCOUNT)
      .then(function (admin) {
        assert.equal(admin, false, 'Other user is an admin');
      })
      .then(done)
      .catch(done);
    });

    it('should keep a count of the number of admins', function (done) {
      colony.adminsCount.call()
      .then(function (_adminsCount) {
        assert.equal(_adminsCount.toNumber(), 1, 'Admin count is different from 1');
      })
      .then(done)
      .catch(done);
    });

    it('should increase admin count by the number of admins added', function (done) {
      colony.addAdmin(OTHER_ACCOUNT)
      .then(function () {
        return colony.adminsCount.call();
      })
      .then(function (_adminsCount) {
        assert.equal(_adminsCount.toNumber(), 2, 'Admin count is incorrect');
      })
      .then(done)
      .catch(done);
    });

    it('should decrease admin count by the number of admins removed', function (done) {
      colony.addAdmin(OTHER_ACCOUNT)
      .then(function () {
        return colony.removeAdmin(OTHER_ACCOUNT);
      })
      .then(function () {
        return colony.adminsCount.call();
      })
      .then(function (_adminsCount) {
        assert.equal(_adminsCount.toNumber(), 1, 'Admin count is incorrect');
      })
      .then(done)
      .catch(done);
    });

    it('should allow a revoked admin to be promoted to an admin again', function (done) {
      colony.addAdmin(OTHER_ACCOUNT)
      .then(function () {
        return colony.removeAdmin(OTHER_ACCOUNT);
      })
      .then(function () {
        return colony.addAdmin(OTHER_ACCOUNT);
      })
      .then(function () {
        return colony.isUserAdmin.call(OTHER_ACCOUNT);
      })
      .then(function (_isAdmin) {
        assert.isTrue(_isAdmin, 'previously revoked admins cannot be promoted to admin again');
      })
      .then(function () {
        return colony.adminsCount.call();
      })
      .then(function (_adminsCount) {
        assert.equal(_adminsCount.toNumber(), 2, 'admins count is incorrect');
      })
      .then(done)
      .catch(done);
    });

    it('should fail to remove the last admin', function (done) {
      const prevBalance = web3.eth.getBalance(MAIN_ACCOUNT);
      colony.removeAdmin(MAIN_ACCOUNT, optionsToSpotTransactionFailure)
      .catch(testHelper.ifUsingTestRPC)
      .then(function () {
        testHelper.checkAllGasSpent(GAS_TO_SPEND, GAS_PRICE, MAIN_ACCOUNT, prevBalance);
      })
      .then(done)
      .catch(done);
    });

    it('should fail to add the same address multiple times', function (done) {
      const prevBalance = web3.eth.getBalance(MAIN_ACCOUNT);
      colony.addAdmin(MAIN_ACCOUNT, optionsToSpotTransactionFailure)
      .catch(testHelper.ifUsingTestRPC)
      .then(function () {
        testHelper.checkAllGasSpent(GAS_TO_SPEND, GAS_PRICE, MAIN_ACCOUNT, prevBalance);
      })
      .then(done)
      .catch(done);
    });

    it('should fail to remove an address that is currently not an admin', function (done) {
      let prevBalance;
      colony.addAdmin(OTHER_ACCOUNT)
      .then(function () {
        return colony.removeAdmin(OTHER_ACCOUNT);
      })
      .then(function () {
        prevBalance = web3.eth.getBalance(MAIN_ACCOUNT);
        return colony.removeAdmin(OTHER_ACCOUNT, {
          from: MAIN_ACCOUNT,
          gasPrice: GAS_PRICE,
          gas: GAS_TO_SPEND,
        });
      })
      .catch(testHelper.ifUsingTestRPC)
      .then(function () {
        testHelper.checkAllGasSpent(GAS_TO_SPEND, GAS_PRICE, MAIN_ACCOUNT, prevBalance);
      })
      .then(done)
      .catch(done);
    });

    it('should fail to remove an address that was never an admin', function (done) {
      const prevBalance = web3.eth.getBalance(MAIN_ACCOUNT);
      colony.removeAdmin(OTHER_ACCOUNT, optionsToSpotTransactionFailure)
      .catch(testHelper.ifUsingTestRPC)
      .then(function () {
        testHelper.checkAllGasSpent(GAS_TO_SPEND, GAS_PRICE, MAIN_ACCOUNT, prevBalance);
      })
      .then(done)
      .catch(done);
    });

    it('should generate tokens and assign it to the colony', function (done) {
      colony.generateTokensWei(100, { from: MAIN_ACCOUNT })
      .then(function () {
        return colony.totalSupply.call();
      })
      .then(function (_totalSupply) {
        assert.equal(_totalSupply.toNumber(), 100, 'Token total is incorrect');
        return colony.balanceOf.call(colony.address);
      })
      .then(function (colonyBalance) {
        assert.equal(colonyBalance.toNumber(), 100, 'Colony balance is incorrect');
      })
      .then(done)
      .catch(done);
    });
  });

  describe('when creating/updating tasks', function () {
    it('should allow admins to make task', function (done) {
      colony.makeTask('name', 'summary')
      .then(function () {
        return eternalStorage.getStringValue.call(solSha3('task_name', 0));
      })
      .then(function (_name) {
        assert.equal(_name, 'name', 'Wrong task name');
        return eternalStorage.getStringValue.call(solSha3('task_summary', 0));
      })
      .then(function (_summary) {
        assert.equal(_summary, 'summary', 'Wrong task summary');
        return eternalStorage.getBooleanValue.call(solSha3('task_accepted', 0));
      })
      .then(function (accepted) {
        assert.equal(accepted, false, 'Wrong accepted value');
        return eternalStorage.getUIntValue.call(solSha3('task_eth', 0));
      })
      .then(function (eth) {
        assert.equal(eth.toNumber(), 0, 'Wrong task ether value');
        return eternalStorage.getUIntValue.call(solSha3('task_tokensWei', 0));
      })
      .then(function (_tokensWei) {
        assert.equal(_tokensWei.toNumber(), 0, 'Wrong tokens wei value');
      })
      .then(done)
      .catch(done);
    });

    it('should allow admins to edit task', function (done) {
      colony.makeTask('name', 'summary')
      .then(function () {
        return colony.updateTask(0, 'nameedit', 'summaryedit');
      })
      .then(function () {
        return eternalStorage.getStringValue.call(solSha3('task_name', 0));
      })
      .then(function (_name) {
        assert.equal(_name, 'nameedit', 'Wrong task name');
        return eternalStorage.getStringValue.call(solSha3('task_summary', 0));
      })
      .then(function (summary) {
        assert.equal(summary, 'summaryedit', 'Wrong task summary');
        return eternalStorage.getBooleanValue.call(solSha3('task_accepted', 0));
      })
      .then(function (taskaccepted) {
        assert.equal(taskaccepted, false, 'Wrong accepted value');
        return eternalStorage.getUIntValue.call(solSha3('task_eth', 0));
      })
      .then(function (eth) {
        assert.equal(eth.toNumber(), 0, 'Wrong task ether value');
        return eternalStorage.getUIntValue.call(solSha3('task_tokensWei', 0));
      })
      .then(function (tokensWei) {
        assert.equal(tokensWei.toNumber(), 0, 'Wrong tokens wei value');
      })
      .then(done)
      .catch(done);
    });

    it('should fail if other users non-admins try to edit a task', function (done) {
      let prevBalance;
      colony.makeTask('name', 'summary').then(function () {
        prevBalance = web3.eth.getBalance(OTHER_ACCOUNT);
        return colony.updateTask(0, 'nameedit', 'summary', {
          from: OTHER_ACCOUNT,
          gasPrice: GAS_PRICE,
          gas: GAS_TO_SPEND,
        });
      })
      .catch(testHelper.ifUsingTestRPC)
      .then(function () {
        testHelper.checkAllGasSpent(GAS_TO_SPEND, GAS_PRICE, OTHER_ACCOUNT, prevBalance);
      })
      .then(done)
      .catch(done);
    });

    it('should fail if other users non-admins try to make a task', function (done) {
      const prevBalance = web3.eth.getBalance(OTHER_ACCOUNT);
      colony.makeTask('name', 'summary', {
        from: OTHER_ACCOUNT,
        gasPrice: GAS_PRICE,
        gas: GAS_TO_SPEND,
      })
      .catch(testHelper.ifUsingTestRPC)
      .then(function () {
        testHelper.checkAllGasSpent(GAS_TO_SPEND, GAS_PRICE, OTHER_ACCOUNT, prevBalance);
      })
      .then(done)
      .catch(done);
    });
  });

  describe('when funding tasks', function () {
    it('should allow admins to fund task with ETH', function (done) {
      colony.makeTask('name', 'summary')
      .then(function () {
        return colony.updateTask(0, 'nameedit', 'summaryedit');
      })
      .then(function () {
        return colony.contributeEthToTask(0, {
          value: 10000,
        });
      })
      .then(function () {
        return eternalStorage.getStringValue.call(solSha3('task_name', 0));
      })
      .then(function (name) {
        assert.equal(name, 'nameedit', 'Wrong task name');
        return eternalStorage.getStringValue.call(solSha3('task_summary', 0));
      })
      .then(function (_summary) {
        assert.equal(_summary, 'summaryedit', 'Wrong task summary');
        return eternalStorage.getBooleanValue.call(solSha3('task_accepted', 0));
      })
      .then(function (a) {
        assert.equal(a, false, 'Wrong accepted value');
        return eternalStorage.getUIntValue.call(solSha3('task_eth', 0));
      })
      .then(function (_eth) {
        assert.equal(_eth.toNumber(), 10000, 'Wrong task ether value');
        return eternalStorage.getUIntValue.call(solSha3('task_tokensWei', 0));
      })
      .then(function (_tokensWei) {
        assert.equal(_tokensWei.toNumber(), 0, 'Wrong tokens wei value');
      })
      .then(done)
      .catch(done);
    });

    it('should fail if non-admins fund task with ETH', function (done) {
      let prevBalance;
      colony.makeTask('name', 'summary')
      .then(function () {
        prevBalance = web3.eth.getBalance(OTHER_ACCOUNT);
        return colony.contributeEthToTask(0, {
          value: 10000,
          from: OTHER_ACCOUNT,
          gasPrice: GAS_PRICE,
          gas: GAS_TO_SPEND,
        });
      })
      .catch(testHelper.ifUsingTestRPC)
      .then(function () {
        testHelper.checkAllGasSpent(GAS_TO_SPEND, GAS_PRICE, OTHER_ACCOUNT, prevBalance);
      })
      .then(done)
      .catch(done);
    });

    it('should allow admins to fund task with own tokens', function (done) {
      colony.generateTokensWei(100, { from: MAIN_ACCOUNT })
      .then(function () {
        return colony.makeTask('name', 'summary');
      })
      .then(function () {
        return colony.makeTask('name2', 'summary2');
      })
      .then(function () {
        return colony.updateTask(0, 'nameedit', 'summary');
      })
      .then(function () {
        return colony.reservedTokensWei.call();
      })
      .then(function (reservedTokensWei) {
        assert.equal(0, reservedTokensWei.toNumber(), 'Colony reserved tokens should be set to initially 0 count.');
        return colony.balanceOf.call(colony.address);
      })
      .then(function (colonyBalance) {
        assert.equal(colonyBalance.toNumber(), 100, 'Colony address balance should be 100 tokens.');
        return colony.contributeTokensWeiFromPool(0, 100, { from: MAIN_ACCOUNT });
      })
      .then(function () {
        return colony.reservedTokensWei.call();
      })
      .then(function (reservedTokensWei) {
        assert.equal(100, reservedTokensWei.toNumber(), 'Colony tokens were not reserved for task');
      })
      .then(function () {
        return colony.completeAndPayTask(0, OTHER_ACCOUNT, { from: MAIN_ACCOUNT });
      })
      .then(function () {
        return colony.balanceOf.call(OTHER_ACCOUNT);
      })
      .then(function (otherAccountTokenBalance) {
        assert.equal(otherAccountTokenBalance.toNumber(), 95, 'OTHER_ACCOUNT balance should be 95 tokens.');
        return colony.addAdmin(OTHER_ACCOUNT);
      })
      .then(function () {
        return colony.contributeTokensWeiToTask(1, 95, { from: OTHER_ACCOUNT });
      })
      .then(function () {
        return eternalStorage.getStringValue.call(solSha3('task_name', 1));
      })
      .then(function (_name) {
        assert.equal(_name, 'name2', 'Wrong task name');
        return eternalStorage.getStringValue.call(solSha3('task_summary', 1));
      })
      .then(function (_summary) {
        assert.equal(_summary, 'summary2', 'Wrong task summary');
        return eternalStorage.getBooleanValue.call(solSha3('task_accepted', 1));
      })
      .then(function (_accepted) {
        assert.equal(_accepted, false, 'Wrong accepted value');
        return eternalStorage.getUIntValue.call(solSha3('task_eth', 1));
      })
      .then(function (_eth) {
        assert.equal(_eth.toNumber(), 0, 'Wrong task ether value');
        return eternalStorage.getUIntValue.call(solSha3('task_tokensWei', 1));
      })
      .then(function (_tokensWei) {
        assert.equal(_tokensWei.toNumber(), 95, 'Wrong tokens wei value');
      })
      .then(done)
      .catch(done);
    });

    it('should reserve the correct number of tokens when admins fund tasks with pool tokens', function (done) {
      colony.generateTokensWei(100, { from: MAIN_ACCOUNT })
      .then(function () {
        return colony.makeTask('name', 'summary');
      })
      .then(function () {
        return colony.contributeTokensWeiFromPool(0, 70, { from: MAIN_ACCOUNT });
      })
      .then(function () {
        return colony.reservedTokensWei.call();
      })
      .then(function (reservedTokensWei) {
        assert.equal(reservedTokensWei.toNumber(), 70, 'Has not reserved the right amount of colony tokens.');
      })
      .then(function () {
        done();
      })
      .catch(done);
    });

    it('should fail if admins fund tasks with more pool tokens than they have available', function (done) {
      let prevBalance;
      colony.generateTokensWei(100, { from: MAIN_ACCOUNT })
      .then(function () {
        return colony.makeTask('name', 'summary');
      })
      .then(function () {
        return colony.makeTask('name2', 'summary2');
      })
      .then(function () {
        return colony.updateTask(0, 'nameedit', 'summary');
      })
      .then(function () {
        return colony.contributeTokensWeiFromPool(0, 100, { from: MAIN_ACCOUNT });
      })
      .then(function () {
        return colony.completeAndPayTask(0, OTHER_ACCOUNT, { from: MAIN_ACCOUNT });
      })
      .then(function () {
        return colony.generateTokensWei(100, { from: MAIN_ACCOUNT });
      })
      .then(function () {
        return colony.makeTask('name', 'summary');
      })
      .then(function () {
        prevBalance = web3.eth.getBalance(MAIN_ACCOUNT);
      })
      .then(function () {
        // More than the pool, less than totalsupply
        return colony.contributeTokensWeiFromPool(1, 150, {
          from: MAIN_ACCOUNT,
          gasPrice: GAS_PRICE,
          gas: GAS_TO_SPEND,
        });
      })
      .catch(testHelper.ifUsingTestRPC)
      .then(function () {
        testHelper.checkAllGasSpent(GAS_TO_SPEND, GAS_PRICE, MAIN_ACCOUNT, prevBalance);
      })
      .then(function () {
        done();
      })
      .catch(done);
    });

    it('should not allow non-admin to close task', function (done) {
      let prevBalance;
      colony.makeTask('name', 'summary')
      .then(function () {
        return colony.updateTask(0, 'nameedit', 'summary');
      })
      .then(function () {
        return colony.contributeEthToTask(0, {
          value: 10000,
        });
      })
      .then(function () {
        prevBalance = web3.eth.getBalance(OTHER_ACCOUNT);
        return colony.completeAndPayTask(0, OTHER_ACCOUNT, { from: OTHER_ACCOUNT });
      })
      .catch(testHelper.ifUsingTestRPC)
      .then(function () {
        return eternalStorage.getStringValue.call(solSha3('task_name', 0));
      })
      .then(function (taskName) {
        assert.equal(taskName, 'nameedit', 'Wrong task name');
        return eternalStorage.getStringValue.call(solSha3('task_summary', 0));
      })
      .then(function (summary) {
        assert.equal(summary, 'summary', 'Wrong task summary');
        return eternalStorage.getBooleanValue.call(solSha3('task_accepted', 0));
      })
      .then(function (_accepted) {
        assert.equal(_accepted, false, 'Wrong accepted value');
        assert.equal(web3.eth.getBalance(OTHER_ACCOUNT).lessThan(prevBalance), true);
      })
      .then(done)
      .catch(done);
    });

    it('should allow admin to close task', function (done) {
      const prevBalance = web3.eth.getBalance(OTHER_ACCOUNT);
      colony.makeTask('name', 'summary')
      .then(function () {
        return colony.updateTask(0, 'nameedit', 'summary');
      })
      .then(function () {
        return colony.contributeEthToTask(0, {
          value: 10000,
        });
      })
      .then(function () {
        return colony.completeAndPayTask(0, OTHER_ACCOUNT, { from: MAIN_ACCOUNT });
      })
      .then(function () {
        return eternalStorage.getStringValue.call(solSha3('task_name', 0));
      })
      .then(function (n) {
        assert.equal(n, 'nameedit', 'Wrong task name');
        return eternalStorage.getStringValue.call(solSha3('task_summary', 0));
      })
      .then(function (s) {
        assert.equal(s, 'summary', 'Wrong task summary');
        return eternalStorage.getBooleanValue.call(solSha3('task_accepted', 0));
      })
      .then(function (_accepted) {
        assert.equal(_accepted, true, 'Wrong accepted value');
        return eternalStorage.getUIntValue.call(solSha3('task_eth', 0));
      })
      .then(function (eth) {
        assert.equal(eth.toNumber(), 10000, 'Wrong task ether value');
        return eternalStorage.getUIntValue.call(solSha3('task_tokensWei', 0));
      })
      .then(function (_tokensWei) {
        assert.equal(_tokensWei.toNumber(), 0, 'Wrong tokens wei value');
        assert.equal(web3.eth.getBalance(OTHER_ACCOUNT).minus(prevBalance).toNumber(), 9500);
      })
      .then(done)
      .catch(done);
    });

    it('should transfer 95% of tokens to task completor and 5% to rootColony on completing a task', function (done) {
      colony.generateTokensWei(100)
      .then(function () {
        return colony.makeTask('name', 'summary');
      })
      .then(function () {
        return colony.updateTask(0, 'nameedit', 'summary');
      })
      .then(function () {
        return colony.contributeTokensWeiFromPool(0, 100);
      })
      .then(function () {
        return colony.completeAndPayTask(0, OTHER_ACCOUNT, { from: MAIN_ACCOUNT });
      })
      .then(function () {
        return colony.balanceOf.call(OTHER_ACCOUNT);
      })
      .then(function (otherAccountTokenBalance) {
        assert.strictEqual(otherAccountTokenBalance.toNumber(), 95, 'Token balance is not 95% of task token value');
        return colony.balanceOf.call(rootColony.address);
      })
      .then(function (rootColonyTokenBalance) {
        assert.strictEqual(rootColonyTokenBalance.toNumber(), 5, 'RootColony token balance is not 5% of task token value');
      })
      .then(done)
      .catch(done);
    });

    it('should fail if non-admins try to contribute with tokens from the pool', function (done) {
      let prevBalance;
      colony.generateTokensWei(100)
      .then(function () {
        return colony.makeTask('name', 'summary');
      })
      .then(function () {
        prevBalance = web3.eth.getBalance(OTHER_ACCOUNT);
        return colony.contributeTokensWeiToTask(0, 100, {
          from: OTHER_ACCOUNT,
          gasPrice: GAS_PRICE,
          gas: GAS_TO_SPEND,
        });
      })
      .catch(testHelper.ifUsingTestRPC)
      .then(function () {
        testHelper.checkAllGasSpent(GAS_TO_SPEND, GAS_PRICE, OTHER_ACCOUNT, prevBalance);
      })
      .then(done)
      .catch(done);
    });

    it('should fail if non-admins try to contribute with tokens', function (done) {
      let prevBalance;
      colony.generateTokensWei(100)
      .then(function () {
        return colony.makeTask('name', 'summary');
      })
      .then(function () {
        prevBalance = web3.eth.getBalance(OTHER_ACCOUNT);
        return colony.contributeTokensWeiFromPool(0, 100, {
          from: OTHER_ACCOUNT,
          gasPrice: GAS_PRICE,
          gas: GAS_TO_SPEND,
        });
      })
      .catch(testHelper.ifUsingTestRPC)
      .then(function () {
        testHelper.checkAllGasSpent(GAS_TO_SPEND, GAS_PRICE, OTHER_ACCOUNT, prevBalance);
      })
      .then(done)
      .catch(done);
    });
  });
});
