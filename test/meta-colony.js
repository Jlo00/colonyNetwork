/* globals artifacts */
import { INITIAL_FUNDING, DELIVERABLE_HASH } from "../helpers/constants";
import { checkErrorRevert } from "../helpers/test-helper";
import {
  fundColonyWithTokens,
  setupFundedTask,
  setupFinalizedTask,
  executeSignedTaskChange,
  makeTask,
  setupColonyNetwork,
  setupMetaColonyWithLockedCLNYToken,
  setupRandomColony
} from "../helpers/test-data-generator";

const ERC20ExtendedToken = artifacts.require("ERC20ExtendedToken");

contract("Meta Colony", accounts => {
  const MANAGER = accounts[0];
  const OTHER_ACCOUNT = accounts[1];
  const WORKER = accounts[2];

  let metaColony;
  let clnyToken;
  let colony;
  let token;
  let colonyNetwork;

  beforeEach(async () => {
    colonyNetwork = await setupColonyNetwork();
    ({ metaColony, clnyToken } = await setupMetaColonyWithLockedCLNYToken(colonyNetwork));

    await colonyNetwork.initialiseReputationMining();
    await colonyNetwork.startNextCycle();
  });

  describe("when working with ERC20 properties of Meta Colony token", () => {
    it("token `symbol` property is correct", async () => {
      const tokenSymbol = await clnyToken.symbol();
      assert.equal(tokenSymbol, "CLNY");
    });

    it("token `decimals` property is correct", async () => {
      const tokenDecimals = await clnyToken.decimals();
      assert.equal(tokenDecimals.toString(), "18");
    });

    it("token `name` property is correct", async () => {
      const tokenName = await clnyToken.name();
      assert.equal(tokenName, "Colony Network Token");
    });
  });

  describe("when adding a new global skill", () => {
    it("should be able to add a new skill as a child to the root skill", async () => {
      await metaColony.addGlobalSkill(1);

      const skillCount = await colonyNetwork.getSkillCount();
      assert.equal(skillCount.toNumber(), 4);

      const newSkill = await colonyNetwork.getSkill(skillCount);
      assert.equal(parseInt(newSkill.nParents, 10), 1);
      assert.equal(parseInt(newSkill.nChildren, 10), 0);

      // Check rootSkill.nChildren is now 1
      const rootSkill = await colonyNetwork.getSkill(1);
      assert.equal(parseInt(rootSkill.nChildren, 10), 1);

      // Check rootSkill.children first element is the id of the new skill
      const rootSkillChild = await colonyNetwork.getChildSkillId(1, 0);
      assert.equal(rootSkillChild.toNumber(), 4);
    });

    it("should not allow a non-founder role in the metacolony to add a global skill", async () => {
      await checkErrorRevert(metaColony.addGlobalSkill(1, { from: OTHER_ACCOUNT }), "ds-auth-unauthorized");
    });

    it("should be able to add multiple child skills to the root global skill", async () => {
      await metaColony.addGlobalSkill(1);
      await metaColony.addGlobalSkill(1);
      await metaColony.addGlobalSkill(1);

      const skillCount = await colonyNetwork.getSkillCount();
      assert.equal(skillCount.toNumber(), 6);

      const newSkill1 = await colonyNetwork.getSkill(4);
      assert.equal(parseInt(newSkill1.nParents, 10), 1);
      assert.equal(parseInt(newSkill1.nChildren, 10), 0);

      const newSkill2 = await colonyNetwork.getSkill(5);
      assert.equal(parseInt(newSkill2.nParents, 10), 1);
      assert.equal(parseInt(newSkill2.nChildren, 10), 0);

      const newSkill3 = await colonyNetwork.getSkill(6);
      assert.equal(parseInt(newSkill3.nParents, 10), 1);
      assert.equal(parseInt(newSkill3.nChildren, 10), 0);

      // Check rootSkill.nChildren is now 3
      const rootSkill = await colonyNetwork.getSkill(1);
      assert.equal(parseInt(rootSkill.nChildren, 10), 3);

      // Check rootSkill.children contains the ids of the new skills
      const rootSkillChild1 = await colonyNetwork.getChildSkillId(1, 0);
      assert.equal(rootSkillChild1.toNumber(), 4);
      const rootSkillChild2 = await colonyNetwork.getChildSkillId(1, 1);
      assert.equal(rootSkillChild2.toNumber(), 5);
      const rootSkillChild3 = await colonyNetwork.getChildSkillId(1, 2);
      assert.equal(rootSkillChild3.toNumber(), 6);
    });

    it("should NOT be able to add a child skill for a non existent parent", async () => {
      // Add 2 skill nodes to root skill
      await metaColony.addGlobalSkill(1);
      await metaColony.addGlobalSkill(1);

      await checkErrorRevert(metaColony.addGlobalSkill(6), "colony-invalid-skill-id");
      const skillCount = await colonyNetwork.getSkillCount();
      assert.equal(skillCount.toNumber(), 5);
    });

    it("should NOT be able to add a child skill to a local skill parent", async () => {
      await checkErrorRevert(metaColony.addGlobalSkill(2), "colony-global-and-local-skill-trees-are-separate");
      const skillCount = await colonyNetwork.getSkillCount();
      assert.equal(skillCount.toNumber(), 3);
    });

    it("should be able to add skills in the middle of the skills tree", async () => {
      await metaColony.addGlobalSkill(1);
      await metaColony.addGlobalSkill(1);
      await metaColony.addGlobalSkill(5);
      await metaColony.addGlobalSkill(1);
      await metaColony.addGlobalSkill(4);
      await metaColony.addGlobalSkill(5);

      const rootSkill = await colonyNetwork.getSkill(1);
      assert.equal(parseInt(rootSkill.nParents, 10), 0);
      assert.equal(parseInt(rootSkill.nChildren, 10), 6);
      const rootSkillChildSkillId1 = await colonyNetwork.getChildSkillId(1, 0);
      assert.equal(rootSkillChildSkillId1.toNumber(), 4);
      const rootSkillChildSkillId2 = await colonyNetwork.getChildSkillId(1, 1);
      assert.equal(rootSkillChildSkillId2.toNumber(), 5);
      const rootSkillChildSkillId3 = await colonyNetwork.getChildSkillId(1, 2);
      assert.equal(rootSkillChildSkillId3.toNumber(), 6);
      const rootSkillChildSkillId4 = await colonyNetwork.getChildSkillId(1, 3);
      assert.equal(rootSkillChildSkillId4.toNumber(), 7);
      const rootSkillChildSkillId5 = await colonyNetwork.getChildSkillId(1, 4);
      assert.equal(rootSkillChildSkillId5.toNumber(), 8);
      const rootSkillChildSkillId6 = await colonyNetwork.getChildSkillId(1, 5);
      assert.equal(rootSkillChildSkillId6.toNumber(), 9);

      const skill1 = await colonyNetwork.getSkill(4);
      assert.equal(parseInt(skill1.nParents, 10), 1);
      assert.equal(parseInt(skill1.nChildren, 10), 1);
      const skill1ParentSkillId1 = await colonyNetwork.getParentSkillId(4, 0);
      assert.equal(skill1ParentSkillId1.toNumber(), 1);
      const skill1ChildSkillId1 = await colonyNetwork.getChildSkillId(4, 0);
      assert.equal(skill1ChildSkillId1.toNumber(), 8);

      const skill2 = await colonyNetwork.getSkill(5);
      assert.equal(parseInt(skill2.nParents, 10), 1);
      assert.equal(parseInt(skill2.nChildren, 10), 2);
      const skill2ParentSkillId1 = await colonyNetwork.getParentSkillId(5, 0);
      assert.equal(skill2ParentSkillId1.toNumber(), 1);
      const skill2ChildSkillId1 = await colonyNetwork.getChildSkillId(5, 0);
      assert.equal(skill2ChildSkillId1.toNumber(), 6);
      const skill2ChildSkillId2 = await colonyNetwork.getChildSkillId(5, 1);
      assert.equal(skill2ChildSkillId2.toNumber(), 9);

      const skill3 = await colonyNetwork.getSkill(6);
      assert.equal(parseInt(skill3.nParents, 10), 2);
      assert.equal(parseInt(skill3.nChildren, 10), 0);
      const skill3ParentSkillId1 = await colonyNetwork.getParentSkillId(6, 0);
      assert.equal(skill3ParentSkillId1.toNumber(), 5);
      const skill3ParentSkillId2 = await colonyNetwork.getParentSkillId(6, 1);
      assert.equal(skill3ParentSkillId2.toNumber(), 1);

      const skill4 = await colonyNetwork.getSkill(7);
      assert.equal(parseInt(skill4.nParents, 10), 1);
      assert.equal(parseInt(skill4.nChildren, 10), 0);
      const skill4ParentSkillId1 = await colonyNetwork.getParentSkillId(7, 0);
      assert.equal(skill4ParentSkillId1.toNumber(), 1);

      const skill5 = await colonyNetwork.getSkill(8);
      assert.equal(parseInt(skill5.nParents, 10), 2);
      assert.equal(parseInt(skill5.nChildren, 10), 0);
      const skill5ParentSkillId1 = await colonyNetwork.getParentSkillId(8, 0);
      assert.equal(skill5ParentSkillId1.toNumber(), 4);
      const skill5ParentSkillId2 = await colonyNetwork.getParentSkillId(8, 1);
      assert.equal(skill5ParentSkillId2.toNumber(), 1);

      const skill6 = await colonyNetwork.getSkill(9);
      assert.equal(parseInt(skill6.nParents, 10), 2);
      assert.equal(parseInt(skill6.nChildren, 10), 0);
      const skill6ParentSkillId1 = await colonyNetwork.getParentSkillId(9, 0);
      assert.equal(skill6ParentSkillId1.toNumber(), 5);
      const skill6ParentSkillId2 = await colonyNetwork.getParentSkillId(9, 1);
      assert.equal(skill6ParentSkillId2.toNumber(), 1);
    });

    it("should correctly ascend the skills tree to find parents", async () => {
      await metaColony.addGlobalSkill(1);
      await metaColony.addGlobalSkill(4);
      await metaColony.addGlobalSkill(5);
      await metaColony.addGlobalSkill(6);
      await metaColony.addGlobalSkill(7);
      await metaColony.addGlobalSkill(8);
      await metaColony.addGlobalSkill(9);
      await metaColony.addGlobalSkill(10);
      await metaColony.addGlobalSkill(11);

      // 1 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12

      const skill = await colonyNetwork.getSkill(12);
      const numParents = skill.nParents;
      const numChildren = skill.nChildren;
      assert.equal(parseInt(numParents, 10), 9);
      assert.equal(parseInt(numChildren, 10), 0);

      let parentId;
      parentId = await colonyNetwork.getParentSkillId(12, 0);
      assert.equal(parentId.toNumber(), 11);
      parentId = await colonyNetwork.getParentSkillId(12, 1);
      assert.equal(parentId.toNumber(), 10);
      parentId = await colonyNetwork.getParentSkillId(12, 2);
      assert.equal(parentId.toNumber(), 9);
      parentId = await colonyNetwork.getParentSkillId(12, 3);
      assert.equal(parentId.toNumber(), 8);
      parentId = await colonyNetwork.getParentSkillId(12, 4);
      assert.equal(parentId.toNumber(), 7);
      parentId = await colonyNetwork.getParentSkillId(12, 5);
      assert.equal(parentId.toNumber(), 6);
      parentId = await colonyNetwork.getParentSkillId(12, 6);
      assert.equal(parentId.toNumber(), 5);
      parentId = await colonyNetwork.getParentSkillId(12, 7);
      assert.equal(parentId.toNumber(), 4);
      parentId = await colonyNetwork.getParentSkillId(12, 8);
      assert.equal(parentId.toNumber(), 1);

      // Higher indices return 0
      parentId = await colonyNetwork.getParentSkillId(12, 9);
      assert.equal(parentId.toNumber(), 0);
      parentId = await colonyNetwork.getParentSkillId(12, 10);
      assert.equal(parentId.toNumber(), 0);
      parentId = await colonyNetwork.getParentSkillId(12, 100);
      assert.equal(parentId.toNumber(), 0);
    });

    it("should NOT be able to add a new root global skill", async () => {
      await checkErrorRevert(metaColony.addGlobalSkill(0), "colony-invalid-skill-id");

      const skillCount = await colonyNetwork.getSkillCount();
      assert.equal(skillCount.toNumber(), 3);
    });
  });

  describe("when adding domains in the meta colony", () => {
    it("should be able to add new domains as children to the root domain", async () => {
      await metaColony.addDomain(1);

      const skillCount = await colonyNetwork.getSkillCount();
      assert.equal(skillCount.toNumber(), 4);
      const domainCount = await metaColony.getDomainCount();
      assert.equal(domainCount.toNumber(), 2);

      const newDomain = await metaColony.getDomain(1);
      assert.equal(parseInt(newDomain.skillId, 10), 2);
      assert.equal(parseInt(newDomain.potId, 10), 1);

      // Check root local skill.nChildren is now 2
      // One special mining skill, and the skill associated with the domain we just added
      const rootLocalSkill = await colonyNetwork.getSkill(2);
      assert.equal(parseInt(rootLocalSkill.nChildren, 10), 2);

      // Check root local skill.children second element is the id of the new skill
      const rootSkillChild = await colonyNetwork.getChildSkillId(2, 1);
      assert.equal(rootSkillChild.toNumber(), 4);
    });

    it("should NOT be able to add a child domain more than one level away from the root domain", async () => {
      await metaColony.addDomain(1);
      await checkErrorRevert(metaColony.addDomain(2), "colony-parent-domain-not-root");

      const skillCount = await colonyNetwork.getSkillCount();
      assert.equal(skillCount.toNumber(), 4);
      const domainCount = await metaColony.getDomainCount();
      assert.equal(domainCount.toNumber(), 2);
    });
  });

  describe("when adding domains in a regular colony", () => {
    beforeEach(async () => {
      colony = await setupRandomColony(colonyNetwork);

      const tokenAddress = await colony.getToken();
      token = await ERC20ExtendedToken.at(tokenAddress);
    });

    it("someone who does not have founder role should not be able to add domains", async () => {
      await checkErrorRevert(colony.addDomain(1, { from: OTHER_ACCOUNT }), "ds-auth-unauthorized");
    });

    it("should be able to add new domains as children to the root domain", async () => {
      await colony.addDomain(1);
      await colony.addDomain(1);
      await colony.addDomain(1);

      const skillCount = await colonyNetwork.getSkillCount();
      assert.equal(skillCount.toNumber(), 7);
      const domainCount = await colony.getDomainCount();
      assert.equal(domainCount.toNumber(), 4);

      const rootDomain = await colony.getDomain(1);
      assert.equal(parseInt(rootDomain.skillId, 10), 4);
      assert.equal(parseInt(rootDomain.potId, 10), 1);

      const newDomain2 = await colony.getDomain(2);
      assert.equal(parseInt(newDomain2.skillId, 10), 5);
      assert.equal(parseInt(newDomain2.potId, 10), 2);

      const newDomain3 = await colony.getDomain(3);
      assert.equal(parseInt(newDomain3.skillId, 10), 6);
      assert.equal(parseInt(newDomain3.potId, 10), 3);
      // Check root local skill.nChildren is now 3
      const rootLocalSkill = await colonyNetwork.getSkill(4);
      assert.equal(parseInt(rootLocalSkill.nChildren, 10), 3);
      // Check root local skill.children are the ids of the new skills
      const rootSkillChild1 = await colonyNetwork.getChildSkillId(4, 0);
      assert.equal(rootSkillChild1.toNumber(), 5);
      const rootSkillChild2 = await colonyNetwork.getChildSkillId(4, 1);
      assert.equal(rootSkillChild2.toNumber(), 6);
      const rootSkillChild3 = await colonyNetwork.getChildSkillId(4, 2);
      assert.equal(rootSkillChild3.toNumber(), 7);
    });

    it("should NOT be able to add a new local skill by anyone but a Colony", async () => {
      await checkErrorRevert(colonyNetwork.addSkill(2, false), "colony-caller-must-be-colony");

      const skillCount = await colonyNetwork.getSkillCount();
      assert.equal(skillCount.toNumber(), 4);
    });

    it("should NOT be able to add a new root local skill", async () => {
      const skillCountBefore = await colonyNetwork.getSkillCount();
      const rootDomain = await colony.getDomain(1);
      const rootLocalSkillId = rootDomain.skillId;
      await checkErrorRevert(colonyNetwork.addSkill(rootLocalSkillId, false), "colony-caller-must-be-colony");
      const skillCountAfter = await colonyNetwork.getSkillCount();

      assert.equal(skillCountBefore.toNumber(), skillCountAfter.toNumber());
    });
  });

  describe("when setting domain and skill on task", () => {
    beforeEach(async () => {
      colony = await setupRandomColony(colonyNetwork);

      const tokenAddress = await colony.getToken();
      token = await ERC20ExtendedToken.at(tokenAddress);
    });

    it("should be able to set domain on task", async () => {
      await colony.addDomain(1);
      const taskId = await makeTask({ colony });

      await executeSignedTaskChange({
        colony,
        functionName: "setTaskDomain",
        taskId,
        signers: [MANAGER],
        sigTypes: [0],
        args: [taskId, 2]
      });

      const task = await colony.getTask(taskId);
      assert.equal(task[7].toNumber(), 2);
    });

    it("should NOT allow a non-manager to set domain on task", async () => {
      await colony.addDomain(1);
      const taskId = await makeTask({ colony });
      await checkErrorRevert(
        executeSignedTaskChange({
          colony,
          functionName: "setTaskDomain",
          taskId,
          signers: [OTHER_ACCOUNT],
          sigTypes: [0],
          args: [taskId, 2]
        }),
        "colony-task-signatures-do-not-match-reviewer-1"
      );

      const task = await colony.getTask(taskId);
      assert.equal(task[7].toNumber(), 1);
    });

    it("should NOT be able to set a domain on nonexistent task", async () => {
      const taskId = await makeTask({ colony });
      const nonexistentTaskId = taskId.addn(10);

      await checkErrorRevert(
        executeSignedTaskChange({
          colony,
          functionName: "setTaskDomain",
          taskId,
          signers: [MANAGER],
          sigTypes: [0],
          args: [nonexistentTaskId, 1]
        }),
        "colony-task-does-not-exist"
      );
    });

    it("should NOT be able to set a nonexistent domain on task", async () => {
      const taskId = await makeTask({ colony });

      await checkErrorRevert(
        executeSignedTaskChange({
          colony,
          functionName: "setTaskDomain",
          taskId,
          signers: [MANAGER],
          sigTypes: [0],
          args: [taskId, 20]
        }),
        "colony-task-change-execution-failed"
      );

      const task = await colony.getTask(taskId);
      assert.equal(task[7].toNumber(), 1);
    });

    it("should NOT be able to set a domain on completed task", async () => {
      await fundColonyWithTokens(colony, token, INITIAL_FUNDING);
      const taskId = await setupFundedTask({ colonyNetwork, colony });
      await colony.submitTaskDeliverable(taskId, DELIVERABLE_HASH, { from: WORKER });

      await checkErrorRevert(
        executeSignedTaskChange({
          colony,
          functionName: "setTaskDomain",
          taskId,
          signers: [MANAGER, WORKER],
          sigTypes: [0, 0],
          args: [taskId, 1]
        }),
        "colony-task-change-execution-failed"
      );
    });

    it("should be able to set global skill on task", async () => {
      await metaColony.addGlobalSkill(1);
      await metaColony.addGlobalSkill(5);

      const taskId = await makeTask({ colony });

      await executeSignedTaskChange({
        colony,
        taskId,
        functionName: "setTaskSkill",
        signers: [MANAGER],
        sigTypes: [0],
        args: [taskId, 6]
      });

      const task = await colony.getTask(taskId);
      assert.equal(task[8][0].toNumber(), 6);
    });

    it("should not allow anyone but the colony to set global skill on task", async () => {
      await metaColony.addGlobalSkill(1);
      await metaColony.addGlobalSkill(5);

      await makeTask({ colony });
      await checkErrorRevert(colony.setTaskSkill(1, 5, { from: OTHER_ACCOUNT }), "colony-not-self");
      const task = await colony.getTask(1);
      assert.equal(task[8][0].toNumber(), 0);
    });

    it("should NOT be able to set global skill on nonexistent task", async () => {
      await checkErrorRevert(colony.setTaskSkill(10, 1), "colony-task-does-not-exist");
    });

    it("should NOT be able to set global skill on completed task", async () => {
      await metaColony.addGlobalSkill(1);
      await metaColony.addGlobalSkill(5);
      await fundColonyWithTokens(colony, token, INITIAL_FUNDING);
      const taskId = await setupFinalizedTask({ colonyNetwork, colony });
      await checkErrorRevert(colony.setTaskSkill(taskId, 6), "colony-task-complete");

      const task = await colony.getTask(taskId);
      assert.equal(task[8][0].toNumber(), 1);
    });

    it("should NOT be able to set nonexistent skill on task", async () => {
      await makeTask({ colony });
      await checkErrorRevert(colony.setTaskSkill(1, 5), "colony-skill-does-not-exist");
    });

    it("should NOT be able to set local skill on task", async () => {
      await makeTask({ colony });
      await checkErrorRevert(colony.setTaskSkill(1, 3), "colony-not-global-skill");
    });
  });

  describe("when getting a skill", () => {
    it("should return a true flag if the skill is global", async () => {
      const globalSkill = await colonyNetwork.getSkill(1);
      assert.isTrue(globalSkill.globalSkill);
    });

    it("should return a false flag if the skill is local", async () => {
      const localSkill = await colonyNetwork.getSkill(2);
      assert.isFalse(localSkill.globalSkill);
    });
  });

  describe("when setting the network fee", () => {
    it("should allow the meta colony founder to set the fee", async () => {
      await metaColony.setNetworkFeeInverse(234);
      const fee = await colonyNetwork.getFeeInverse();
      assert.equal(fee, 234);
    });

    it("should not allow anyone else but the meta colony founder to set the fee", async () => {
      await checkErrorRevert(metaColony.setNetworkFeeInverse(234, { from: accounts[1] }), "ds-auth-unauthorized");
      const fee = await colonyNetwork.getFeeInverse();
      assert.equal(fee, 100);
    });

    it("should not allow another account, than the meta colony, to set the fee", async () => {
      await checkErrorRevert(colonyNetwork.setFeeInverse(100), "colony-caller-must-be-meta-colony");
    });

    it("should not allow the fee to be set to zero", async () => {
      await checkErrorRevert(metaColony.setNetworkFeeInverse(0), "colony-network-fee-inverse-cannot-be-zero");
    });
  });
});
