import chai, {expect} from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
import {config, create, clear, Model} from '../lib';

describe('GraphQLModel', () => {
  beforeEach(() => {
    clear();
    config({
      read: true,
      readFail: null,
    });
  });


  it('no rules', () => {
    const Model = create({
      name: 'Model',
    });

    const m = new Model({a: 1, b: 2});
    expect(m.a).to.be.undefined;
    expect(m.b).to.be.undefined;
  });


  it('basic access rules', () => {
    const Model = create({
      name: 'Model',
      rules: {
        a: true, // always allow
        b: false, // always disallow
        c: () => true, // always allow
        d: () => false, // always disallow
        e: {}, // defaults
        f: {
          read: false, // always disallow
          // uses default readFail
        },
        g: {
          read: false, // always disallow
          readFail: new Error(), // return an error when failed
        },
        h: {
          read: false, // always disallow
          readFail: () => { throw new Error(); }, // throw when fail
        },
        i: {
          read: ({$data}) => $data.i, // allow based on its value
        },
      },
    });

    const m = new Model({a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 1});

    expect(m.a).to.equal(1);

    expect(m.b).to.be.null;

    expect(m.c).to.equal(3);

    expect(m.d).to.be.null;

    expect(m.e).to.equal(5);

    expect(m.f).to.be.null;

    expect(m.g).to.be.an.instanceof(Error);

    expect(() => m.h).to.throw(Error);

    // should return its value since its truthy
    expect(m.i).to.equal(1);

    m.$data.i = 0; // change raw value
    expect(m.i).to.equal(1); // cached

    // should return null since its falsy
    delete m.i; // remove cached value
    expect(m.i).to.be.null; // recalculate value

    m.i = 2; // overwrite
    expect(m.i).to.equal(2);
  });


  it('cache', () => {
    let aCount = 0;
    let bCount = 0;

    const Model = create({
      name: 'Model',
      rules: {
        a: {
          read: () => ++aCount,
          cache: true,
        },
        b: {
          read: () => ++bCount,
          cache: false,
        },
      },
    });

    const m = new Model({a: 1, b: 1});

    expect(m.a).to.equal(1);
    expect(m.a).to.equal(1);
    expect(aCount).to.equal(1);

    expect(m.b).to.equal(1);
    expect(m.b).to.equal(1);
    expect(bCount).to.equal(2);
  });


  it('$props', () => {
    let callCount = 0;

    const Model = create({
      name: 'Model',
      props: {
        isAdmin: ({$context}) => Boolean($context.admin),
        isGuest: ({$context}) => !$context.id,
        isAuthenticated: ({$props}) => !$props.isGuest,
        isOwner: ({$props: {authorId, authId}}) => authorId === authId,
        authId: ({$context}) => $context.id,
        authorId: ({$data}) => $data.id,
        callCount: () => ++callCount,
      },
      rules: {
        adminField: ({$props}) => $props.isAdmin,
        authField: ({$props}) => $props.isAuthenticated,
        guestField: ({$props}) => $props.isGuest,
        ownerField: ({$props}) => $props.isOwner,
      },
    });

    const auth = {id: 1, admin: true};


    const m1 = new Model({
      id: 1,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5,
    }, auth);

    expect(m1.$props.isAdmin).to.be.true;
    expect(m1.$props.isGuest).to.be.false;
    expect(m1.$props.isAuthenticated).to.be.true;
    expect(m1.$props.isOwner).to.be.true;
    expect(m1.$props.authId).to.equal(1);
    expect(m1.$props.authorId).to.equal(1);

    expect(m1.$props.callCount).to.equal(1); // not cached
    expect(m1.$props.callCount).to.equal(1); // cached

    expect(m1.adminField).to.equal(2);
    expect(m1.authField).to.equal(3);
    expect(m1.guestField).to.be.null;
    expect(m1.ownerField).to.equal(5);


    const m2 = new Model({
      id: 2,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5,
    }, auth);

    expect(m2.$props.isAdmin).to.be.true;
    expect(m2.$props.isGuest).to.be.false;
    expect(m2.$props.isAuthenticated).to.be.true;
    expect(m2.$props.isOwner).to.be.false;
    expect(m2.$props.authId).to.equal(1);
    expect(m2.$props.authorId).to.equal(2);
    expect(m2.$props.callCount).to.equal(2); // not cached
    expect(m2.$props.callCount).to.equal(2); // cached

    expect(m2.adminField).to.equal(2);
    expect(m2.authField).to.equal(3);
    expect(m2.guestField).to.be.null;
    expect(m2.ownerField).to.be.null;


    const auth2 = {id: 4, admin: false};
    const m3 = new Model({
      id: 3,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5,
    }, auth2);

    expect(m3.$props.isAdmin).to.be.false;
    expect(m3.$props.isGuest).to.be.false;
    expect(m3.$props.isAuthenticated).to.be.true;
    expect(m3.$props.isOwner).to.be.false;
    expect(m3.$props.authId).to.equal(4);
    expect(m3.$props.authorId).to.equal(3);
    expect(m3.$props.callCount).to.equal(3);
    expect(m3.$props.callCount).to.equal(3);

    expect(m3.adminField).to.be.null;
    expect(m3.authField).to.equal(3);
    expect(m3.guestField).to.be.null;
    expect(m3.ownerField).to.be.null;


    const m4 = new Model({
      id: 4,
      adminField: 2,
      authField: 3,
      guestField: 4,
      ownerField: 5,
    }, {});

    expect(m4.$props.isAdmin).to.be.false;
    expect(m4.$props.isGuest).to.be.true;
    expect(m4.$props.isAuthenticated).to.be.false;
    expect(m4.$props.isOwner).to.be.false;
    expect(m4.$props.authId).to.be.undefined;
    expect(m4.$props.authorId).to.equal(4);
    expect(m4.$props.callCount).to.equal(4);
    expect(m4.$props.callCount).to.equal(4);

    expect(m4.adminField).to.be.null;
    expect(m4.authField).to.be.null;
    expect(m4.guestField).to.equal(4);
    expect(m4.ownerField).to.be.null;
  });


  it('Parent / Child', () => {
    const Parent = create({
      name: 'Parent',
      rules: {
        child: {
          type: 'Child',
        },
        children: {
          type: 'Child',
          list: true,
        },
      },
    });

    const Child = create({
      name: 'Child',
      rules: {
        id: true,
        child: {
          type: 'GrandChild',
        },
      },
    });

    const GrandChild = create({
      name: 'GrandChild',
      rules: {
        id: true,
      },
    });

    const context = {};

    const p = new Parent({
      child: {id: 1, child: {id: 4}},
      children: [{id: 2}, {id: 3}],
    }, context);

    expect(p.child).to.be.an.instanceof(Child);
    expect(p.child.id).to.equal(1);
    expect(p.child).to.equal(p.child); // cached

    expect(p.child.child).to.be.an.instanceof(GrandChild);
    expect(p.child.child.id).to.equal(4);
    expect(p.child.child).to.equal(p.child.child); // cached

    expect(p.child.child.$parent).to.equal(p.child);
    expect(p.child.child.$parent.$parent).to.equal(p);

    expect(p.child.child.$root).to.equal(p);

    expect(p.child.child.$context).to.equal(context);

    expect(p.child.child.$parentOfType('Child')).to.equal(p.child);
    expect(p.child.child.$parentOfType('Parent')).to.equal(p);
    expect(p.child.child.$parentOfType('GrandChild')).to.be.null;

    expect(p.children.length).to.equal(2);

    expect(p.children[0]).to.be.an.instanceof(Child);
    expect(p.children[0].id).to.equal(2);

    expect(p.children[1]).to.be.an.instanceof(Child);
    expect(p.children[1].id).to.equal(3);

    expect(p.children).to.equal(p.children); // cached
    expect(p.children[0]).to.equal(p.children[0]); // cached

    expect(p.child.$parent).to.equal(p);
    expect(p.children[0].$parent).to.equal(p);
    expect(p.children[0].$root).to.equal(p);

    expect(p.$context).to.equal(context);
    expect(p.child.$context).to.equal(context);
    expect(p.children[0].$context).to.equal(context);
  });


  it('Class extention', () => {
    const Base = create({
      name: 'Base',
      props: {
        prop1: () => 1,
        prop2: () => 2,
      },
      rules: {
        field1: true,
        field2: false,
      },
    });

    const Class = create({
      name: 'Class',
      base: Base,
      props: {
        prop2: () => 3,
        prop3: () => 4,
      },
      rules: {
        field2: true,
        field3: true,
      },
    });

    const u = new Class({
      field1: 1,
      field2: 2,
      field3: 3,
    });

    expect(u).to.be.an.instanceof(Class);
    expect(u).to.be.an.instanceof(Base);
    expect(u).to.be.an.instanceof(Model);

    expect(u.field1).to.equal(1);
    expect(u.field2).to.equal(2); // override
    expect(u.field3).to.equal(3);

    // inherited props
    expect(u.$props.prop1).to.equal(1);
    expect(u.$props.prop2).to.equal(3);
    expect(u.$props.prop3).to.equal(4);
  });


  it('Interfaces', () => {
    const Node = create({
      name: 'Node',
      props: {
        prop1: () => 1,
        prop2: () => 2,
      },
      rules: {
        id: true,
      },
    });

    const User = create({
      name: 'Child',
      interfaces: [Node],
      props: {
        prop2: () => 3,
        prop3: () => 4,
      },
      rules: {
        name: true,
      },
    });

    const u = new User({
      id: 1,
      name: 'hi',
    });

    // inherited rules
    expect(u.id).to.equal(1);

    expect(u.name).to.equal('hi');

    expect(u.$implements(Node)).to.be.true;

    // inherited props
    expect(u.$props.prop1).to.equal(1);
    expect(u.$props.prop2).to.equal(3);
    expect(u.$props.prop3).to.equal(4);
  });
});
